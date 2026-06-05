package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPresetInstruments(t *testing.T) {
	cases := []struct {
		preset string
		want   []string
		ok     bool
	}{
		{"cpu", []string{"CPU Profiler"}, true},
		{"memory", []string{"Allocations", "Leaks"}, true},
		{"energy", []string{"Power Profiler"}, true},
		{"bogus", nil, false},
	}
	for _, c := range cases {
		got, ok := presetInstruments(c.preset)
		if ok != c.ok {
			t.Errorf("presetInstruments(%q) ok = %v, want %v", c.preset, ok, c.ok)
			continue
		}
		if ok && !equalStrings(got, c.want) {
			t.Errorf("presetInstruments(%q) = %v, want %v", c.preset, got, c.want)
		}
	}
}

// TestPresetFamiliesMatchAnalyzer pins the preset → analyze-family contract:
// every preset declares the families it should produce, and every declared
// family is a real one in analyze.go. Guards against drift when Phase 2d wires
// up memory/network/energy parsing.
func TestPresetFamiliesMatchAnalyzer(t *testing.T) {
	known := make(map[string]bool, len(families))
	for _, f := range families {
		known[f.name] = true
	}
	for _, p := range presetNames {
		fams, ok := presetFamilies[p]
		if !ok || len(fams) == 0 {
			t.Errorf("preset %q has no declared families in presetFamilies", p)
			continue
		}
		for _, fam := range fams {
			if !known[fam] {
				t.Errorf("preset %q declares family %q, which is not in analyze.go families", p, fam)
			}
		}
	}
	// Every preset that exists must be declared, so a newly-added preset can't
	// silently skip the contract.
	for name := range presets {
		if _, ok := presetFamilies[name]; !ok {
			t.Errorf("preset %q exists but is missing from presetFamilies", name)
		}
	}
}

// effectiveTimeLimit is the S-3 ceiling: every recording is bounded, and a
// requested limit may never exceed --max-duration.
func TestEffectiveTimeLimit(t *testing.T) {
	cases := []struct {
		name      string
		timeLimit string
		maxDur    string
		want      string
		wantErr   bool
	}{
		{"defaults to the 60s ceiling when unbounded", "", "", "60s", false},
		{"unset request adopts an explicit ceiling", "", "30s", "30s", false},
		{"request under the ceiling is kept", "10s", "60s", "10s", false},
		{"request equal to the ceiling is kept", "60s", "60s", "60s", false},
		{"request over the ceiling is refused", "90s", "60s", "", true},
		{"compound request normalizes to whole seconds", "1m30s", "5m", "90s", false},
		{"sub-second request keeps millisecond unit", "1500ms", "2s", "1500ms", false},
		{"zero request is refused", "0s", "60s", "", true},
		{"unparseable request is refused", "soon", "60s", "", true},
		{"unparseable ceiling is refused", "5s", "lots", "", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := effectiveTimeLimit(c.timeLimit, c.maxDur)
			if (err != nil) != c.wantErr {
				t.Fatalf("effectiveTimeLimit(%q,%q) err = %v, wantErr %v", c.timeLimit, c.maxDur, err, c.wantErr)
			}
			if !c.wantErr && got != c.want {
				t.Errorf("effectiveTimeLimit(%q,%q) = %q, want %q", c.timeLimit, c.maxDur, got, c.want)
			}
		})
	}
}

func TestPathWithin(t *testing.T) {
	cases := []struct {
		root, target string
		want         bool
	}{
		{"/a/b", "/a/b/c.trace", true},
		{"/a/b", "/a/b", true},
		{"/a/b", "/a/c.trace", false},
		{"/a/b", "/a/bc/d.trace", false}, // sibling-prefix trap, not containment
		{"/a/b", "/a/b/../x.trace", false},
	}
	for _, c := range cases {
		if got := pathWithin(c.root, filepath.Clean(c.target)); got != c.want {
			t.Errorf("pathWithin(%q,%q) = %v, want %v", c.root, c.target, got, c.want)
		}
	}
}

// resolveTraceOutput enforces the XCPROF_TRACE_ROOT sandbox and produces a
// concrete, reportable .trace path.
func TestResolveTraceOutput(t *testing.T) {
	const root = "/sandbox"
	const cwd = "/sandbox/work"
	const now = 1700000000

	t.Run("empty output lands a generated name in the root", func(t *testing.T) {
		got, err := resolveTraceOutput("", cwd, root, "cpu", now, false)
		if err != nil {
			t.Fatal(err)
		}
		want := "/sandbox/xcprof-cpu-1700000000.trace"
		if got != want {
			t.Errorf("got %q, want %q", got, want)
		}
	})

	t.Run("non-.trace path is treated as a directory", func(t *testing.T) {
		got, err := resolveTraceOutput("/sandbox/out", cwd, root, "cpu", now, false)
		if err != nil {
			t.Fatal(err)
		}
		want := "/sandbox/out/xcprof-cpu-1700000000.trace"
		if got != want {
			t.Errorf("got %q, want %q", got, want)
		}
	})

	t.Run("explicit .trace file inside the sandbox is honored", func(t *testing.T) {
		got, err := resolveTraceOutput("run.trace", cwd, root, "cpu", now, false)
		if err != nil {
			t.Fatal(err)
		}
		if got != "/sandbox/work/run.trace" {
			t.Errorf("got %q, want /sandbox/work/run.trace", got)
		}
	})

	t.Run("path outside the sandbox is refused without the gate", func(t *testing.T) {
		if _, err := resolveTraceOutput("/tmp/evil.trace", cwd, root, "cpu", now, false); err == nil {
			t.Error("expected refusal for an out-of-sandbox output path")
		}
	})

	t.Run("the external gate permits an outside path", func(t *testing.T) {
		got, err := resolveTraceOutput("/tmp/ok.trace", cwd, root, "cpu", now, true)
		if err != nil || got != "/tmp/ok.trace" {
			t.Errorf("gate should allow external path: got %q err %v", got, err)
		}
	})

	// A symlink planted inside the sandbox must not smuggle the output out:
	// containment is checked against symlink-resolved paths, not just text.
	t.Run("a symlink escaping the sandbox is refused", func(t *testing.T) {
		realRoot := t.TempDir()
		outside := t.TempDir()
		link := filepath.Join(realRoot, "escape")
		if err := os.Symlink(outside, link); err != nil {
			t.Skipf("symlink unsupported: %v", err)
		}
		if _, err := resolveTraceOutput(filepath.Join(link, "evil.trace"), realRoot, realRoot, "cpu", now, false); err == nil {
			t.Error("output through an escaping symlink should be refused")
		}
		// The same path is allowed once the external gate is set.
		if _, err := resolveTraceOutput(filepath.Join(link, "evil.trace"), realRoot, realRoot, "cpu", now, true); err != nil {
			t.Errorf("external gate should permit the escaping path: %v", err)
		}
	})
}

func TestResolveInstrumentationPrecedence(t *testing.T) {
	t.Run("default is the cpu preset", func(t *testing.T) {
		tmpl, insts, used, err := resolveInstrumentation(recordOpts{})
		if err != nil || tmpl != "" || used != "cpu" || !equalStrings(insts, []string{"CPU Profiler"}) {
			t.Errorf("got tmpl=%q insts=%v used=%q err=%v", tmpl, insts, used, err)
		}
	})
	t.Run("explicit template wins and reports no preset", func(t *testing.T) {
		tmpl, insts, used, err := resolveInstrumentation(recordOpts{template: "System Trace"})
		if err != nil || tmpl != "System Trace" || used != "" || len(insts) != 0 {
			t.Errorf("got tmpl=%q insts=%v used=%q err=%v", tmpl, insts, used, err)
		}
	})
	t.Run("explicit instruments win and report no preset", func(t *testing.T) {
		tmpl, insts, used, err := resolveInstrumentation(recordOpts{instruments: []string{"Leaks"}})
		if err != nil || tmpl != "" || used != "" || !equalStrings(insts, []string{"Leaks"}) {
			t.Errorf("got tmpl=%q insts=%v used=%q err=%v", tmpl, insts, used, err)
		}
	})
	t.Run("combining sources is a conflict", func(t *testing.T) {
		if _, _, _, err := resolveInstrumentation(recordOpts{preset: "cpu", template: "Leaks"}); err == nil {
			t.Error("expected conflict when both --preset and --template are set")
		}
	})
	t.Run("unknown preset is refused", func(t *testing.T) {
		if _, _, _, err := resolveInstrumentation(recordOpts{preset: "bogus"}); err == nil {
			t.Error("expected error for unknown preset")
		}
	})
}

func TestValidateTargets(t *testing.T) {
	cases := []struct {
		name    string
		opts    recordOpts
		wantErr bool
	}{
		{"no target is an error", recordOpts{}, true},
		{"attach alone is fine", recordOpts{attach: "MyApp"}, false},
		{"two targets is an error", recordOpts{attach: "MyApp", allProcesses: true, allowAllProcesses: true}, true},
		{"launch is refused without the gate", recordOpts{launchCmd: []string{"/bin/echo"}}, true},
		{"launch is allowed with the gate", recordOpts{launchCmd: []string{"/bin/echo"}, allowLaunch: true}, false},
		{"all-processes is refused without the gate", recordOpts{allProcesses: true}, true},
		{"all-processes is allowed with the gate", recordOpts{allProcesses: true, allowAllProcesses: true}, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if err := validateTargets(c.opts); (err != nil) != c.wantErr {
				t.Errorf("validateTargets(%+v) err = %v, wantErr %v", c.opts, err, c.wantErr)
			}
		})
	}
}

func TestBuildRecordArgv(t *testing.T) {
	t.Run("instruments, time-limit, output, and launch placed last", func(t *testing.T) {
		argv := buildRecordArgv(recordSpec{
			instruments: []string{"CPU Profiler", "Leaks"},
			output:      "/s/out.trace",
			timeLimit:   "30s",
			launchCmd:   []string{"/usr/bin/python3", "-c", "pass"},
			noPrompt:    true,
		})
		want := []string{
			"xctrace", "record",
			"--instrument", "CPU Profiler",
			"--instrument", "Leaks",
			"--output", "/s/out.trace",
			"--time-limit", "30s",
			"--no-prompt",
			"--launch", "--", "/usr/bin/python3", "-c", "pass",
		}
		if !equalStrings(argv, want) {
			t.Errorf("argv mismatch:\n got %v\nwant %v", argv, want)
		}
	})

	t.Run("template form with attach target", func(t *testing.T) {
		argv := buildRecordArgv(recordSpec{template: "CPU Profiler", timeLimit: "60s", attach: "1234"})
		want := []string{"xctrace", "record", "--template", "CPU Profiler", "--time-limit", "60s", "--attach", "1234"}
		if !equalStrings(argv, want) {
			t.Errorf("argv mismatch:\n got %v\nwant %v", argv, want)
		}
	})

	t.Run("launch must be the final tokens", func(t *testing.T) {
		argv := buildRecordArgv(recordSpec{instruments: []string{"CPU Profiler"}, launchCmd: []string{"app", "--flag"}})
		last := argv[len(argv)-4:]
		if !equalStrings(last, []string{"--launch", "--", "app", "--flag"}) {
			t.Errorf("launch tokens must be last, got tail %v", last)
		}
	})
}

func TestParseRecordArgsLaunchSplit(t *testing.T) {
	opts, code := parseRecordArgs([]string{"--allow-launch", "--time-limit", "5s", "--", "/usr/bin/python3", "-c", "x=1"})
	if code != 0 {
		t.Fatalf("parse code = %d, want 0", code)
	}
	if !opts.allowLaunch || opts.timeLimit != "5s" {
		t.Errorf("flags not parsed: %+v", opts)
	}
	if !equalStrings(opts.launchCmd, []string{"/usr/bin/python3", "-c", "x=1"}) {
		t.Errorf("launchCmd = %v", opts.launchCmd)
	}
}

func TestParseRecordArgsRepeatedInstrument(t *testing.T) {
	opts, code := parseRecordArgs([]string{"--instrument", "Allocations", "--instrument", "Leaks", "--attach", "MyApp"})
	if code != 0 {
		t.Fatalf("parse code = %d", code)
	}
	if !equalStrings(opts.instruments, []string{"Allocations", "Leaks"}) {
		t.Errorf("instruments = %v", opts.instruments)
	}
}

func TestParseRecordArgsStrayPositional(t *testing.T) {
	// A bare positional (no `--`) is ambiguous with a launch target; reject it
	// so the user is forced to use `-- <cmd>` for launches.
	if _, code := parseRecordArgs([]string{"--attach", "MyApp", "junk"}); code != 2 {
		t.Errorf("expected usage error (2) for a stray positional, got %d", code)
	}
}

// A dry run must describe the exact command without spawning xctrace.
func TestRunRecordDryRun(t *testing.T) {
	t.Setenv("XCPROF_TRACE_ROOT", t.TempDir())
	var buf bytes.Buffer
	code := runRecord(&buf, []string{"--preset", "cpu", "--attach", "MyApp", "--dry-run", "--json"})
	if code != 0 {
		t.Fatalf("dry-run exit = %d, want 0; output: %s", code, buf.String())
	}
	var rep RecordReport
	if err := json.Unmarshal(buf.Bytes(), &rep); err != nil {
		t.Fatalf("dry-run output is not valid JSON: %v\n%s", err, buf.String())
	}
	if !rep.DryRun || !rep.OK {
		t.Errorf("dry-run flags wrong: %+v", rep)
	}
	if rep.Preset != "cpu" || rep.Target != "attach:MyApp" || rep.TargetMode != "attach" || rep.TimeLimit != "60s" {
		t.Errorf("report fields wrong: %+v", rep)
	}
	if len(rep.Command) == 0 || rep.Command[0] != "xcrun" {
		t.Errorf("command should be reported and start with xcrun: %v", rep.Command)
	}
}

func TestRunRecordRefusesLaunchWithoutGate(t *testing.T) {
	var buf bytes.Buffer
	code := runRecord(&buf, []string{"--dry-run", "--", "/usr/bin/python3"})
	if code != 2 {
		t.Errorf("launch without --allow-launch should fail (2), got %d", code)
	}
}

// outputPathFromArgv pulls the --output value out of a built xctrace argv so a
// fake recorder can create the trace bundle the real xctrace would.
func outputPathFromArgv(argv []string) string {
	for i, a := range argv {
		if a == "--output" && i+1 < len(argv) {
			return argv[i+1]
		}
	}
	return ""
}

// A launched recording terminated at the time limit makes xctrace exit non-zero
// while still saving the trace. runRecord must treat the saved bundle as
// success, not the exit code.
func TestRunRecordTraceSavedDespiteNonZeroExit(t *testing.T) {
	t.Setenv("XCPROF_TRACE_ROOT", t.TempDir())
	orig := runRecordCmd
	t.Cleanup(func() { runRecordCmd = orig })
	runRecordCmd = func(_ context.Context, _ time.Duration, argv []string) (ExecResult, error) {
		out := outputPathFromArgv(argv)
		if out == "" {
			t.Fatalf("no --output in argv: %v", argv)
		}
		if err := os.MkdirAll(out, 0o755); err != nil { // simulate the saved .trace bundle
			t.Fatal(err)
		}
		return ExecResult{}, fmt.Errorf("xcrun: exit status 54: ") // xctrace's killed-child status
	}

	var buf bytes.Buffer
	code := runRecord(&buf, []string{"--preset", "cpu", "--allow-launch", "--time-limit", "1s", "--", "/usr/bin/true"})
	if code != 0 {
		t.Fatalf("exit = %d, want 0 (trace was saved despite non-zero xctrace exit); output: %s", code, buf.String())
	}
	var rep RecordReport
	if err := json.Unmarshal(buf.Bytes(), &rep); err != nil {
		t.Fatalf("invalid JSON: %v\n%s", err, buf.String())
	}
	if !rep.OK {
		t.Errorf("ok should be true when the trace bundle exists: %+v", rep)
	}
	if len(rep.Notes) == 0 {
		t.Errorf("a saved-despite-non-zero-exit note should be attached: %+v", rep)
	}
}

// A timeout-killed recording that still left a (possibly partial) bundle is
// reported as ok, but with an explicit "may be incomplete" note — not silently
// passed off as a clean capture.
func TestRunRecordTimeoutFlagsIncompleteTrace(t *testing.T) {
	t.Setenv("XCPROF_TRACE_ROOT", t.TempDir())
	orig := runRecordCmd
	t.Cleanup(func() { runRecordCmd = orig })
	runRecordCmd = func(_ context.Context, timeout time.Duration, argv []string) (ExecResult, error) {
		out := outputPathFromArgv(argv)
		if err := os.MkdirAll(out, 0o755); err != nil {
			t.Fatal(err)
		}
		return ExecResult{}, &TimeoutError{Cmd: "xcrun", Timeout: timeout}
	}

	var buf bytes.Buffer
	code := runRecord(&buf, []string{"--preset", "cpu", "--attach", "MyApp"})
	if code != 0 {
		t.Fatalf("exit = %d, want 0 (bundle exists); output: %s", code, buf.String())
	}
	var rep RecordReport
	if err := json.Unmarshal(buf.Bytes(), &rep); err != nil {
		t.Fatalf("invalid JSON: %v\n%s", err, buf.String())
	}
	if !rep.OK {
		t.Errorf("ok should be true when a bundle exists: %+v", rep)
	}
	joined := strings.Join(rep.Notes, " ")
	if !strings.Contains(joined, "incomplete") {
		t.Errorf("a timeout should attach an incomplete-trace note, got notes %v", rep.Notes)
	}
}

// When xctrace fails AND writes no trace, that is a real failure.
func TestRunRecordNoTraceIsFailure(t *testing.T) {
	t.Setenv("XCPROF_TRACE_ROOT", t.TempDir())
	orig := runRecordCmd
	t.Cleanup(func() { runRecordCmd = orig })
	runRecordCmd = func(_ context.Context, _ time.Duration, _ []string) (ExecResult, error) {
		return ExecResult{Stderr: []byte("device not found")}, fmt.Errorf("xcrun: exit status 1")
	}

	var buf bytes.Buffer
	code := runRecord(&buf, []string{"--preset", "cpu", "--attach", "Ghost"})
	if code != 2 {
		t.Fatalf("exit = %d, want 2 (no trace produced)", code)
	}
	var rep RecordReport
	if err := json.Unmarshal(buf.Bytes(), &rep); err != nil {
		t.Fatalf("invalid JSON: %v\n%s", err, buf.String())
	}
	if rep.OK || len(rep.Problems) == 0 {
		t.Errorf("a no-trace run must report failure with problems: %+v", rep)
	}
}

// Recording onto an existing trace is refused up front, so a stale bundle can
// never be mistaken for a fresh success.
func TestRunRecordRefusesExistingTrace(t *testing.T) {
	root := t.TempDir()
	t.Setenv("XCPROF_TRACE_ROOT", root)
	existing := filepath.Join(root, "taken.trace")
	if err := os.MkdirAll(existing, 0o755); err != nil {
		t.Fatal(err)
	}
	orig := runRecordCmd
	t.Cleanup(func() { runRecordCmd = orig })
	called := false
	runRecordCmd = func(context.Context, time.Duration, []string) (ExecResult, error) {
		called = true
		return ExecResult{}, nil
	}

	var buf bytes.Buffer
	code := runRecord(&buf, []string{"--preset", "cpu", "--attach", "MyApp", "--output", "taken.trace"})
	if code != 2 {
		t.Errorf("recording onto an existing trace should fail (2), got %d", code)
	}
	if called {
		t.Error("xctrace must not be invoked when the output trace already exists")
	}
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
