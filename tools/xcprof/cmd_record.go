package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// defaultMaxDuration is the hard ceiling applied when the caller gives no
// --max-duration. Every recording is bounded so an agent can't capture
// unbounded (ADR-002 security gate; CLAUDE.md S-3).
const defaultMaxDuration = "60s"

// recordExecGrace is added to the recording's time limit when sizing the exec
// timeout, so trace finalization/saving isn't killed mid-write.
const recordExecGrace = 120 * time.Second

// presets map a preset name to a verified-on-Xcode-26 instrument set. Two
// instrument choices are deliberate and verified empirically (axiom-o4sg), NOT
// from memory:
//   - cpu uses "CPU Profiler" (schema cpu-profile, which analyze parses), NOT
//     "Time Profiler" (time-profile/time-sample, unparsed).
//   - network uses "Network Connections" (schema network-connection-stat, which
//     analyze parses — socket-level, any process), NOT "HTTP Traffic" (cfnetwork
//     tables that only populate for URLSession traffic and analyze doesn't read).
//
// Allocations/Leaks stay in the memory/full presets so a user can open the
// recording in Instruments.app, even though analyze can't export their data.
// Names verified via `xctrace list instruments`; do not edit from memory.
var presets = map[string][]string{
	"cpu":      {"CPU Profiler"},
	"memory":   {"Allocations", "Leaks"},
	"network":  {"CPU Profiler", "Network Connections"},
	"energy":   {"Power Profiler"},
	"full":     {"CPU Profiler", "Allocations", "Leaks", "Network Connections"},
	"full-ios": {"CPU Profiler", "Allocations", "Leaks", "Network Connections", "Power Profiler"},
}

// presetNames is the stable display order for usage/error text.
var presetNames = []string{"cpu", "memory", "network", "energy", "full", "full-ios"}

// presetFamilies declares which analyze families (see analyze.go `families`)
// each preset is intended to make `available`. It's the explicit, testable half
// of the otherwise-implicit chain preset → instrument → exported schema →
// analyze family: TestPresetFamiliesMatchAnalyzer asserts every name here is a
// real family, so a rename in analyze.go or a typo here fails the build before
// Phase 2d (axiom-o4sg) wires up family parsing. It can't verify instrument
// names (only a live xctrace can), but it pins the family-level contract.
var presetFamilies = map[string][]string{
	"cpu":      {"cpu"},
	"memory":   {"memory"},
	"network":  {"cpu", "network"}, // records CPU Profiler + Network Connections
	"energy":   {"energy"},
	"full":     {"cpu", "memory", "network"},
	"full-ios": {"cpu", "memory", "network", "energy"},
}

func presetInstruments(preset string) ([]string, bool) {
	insts, ok := presets[preset]
	return insts, ok
}

// recordOpts is the parsed CLI surface of `xcprof record`.
type recordOpts struct {
	preset       string
	template     string
	instruments  []string
	attach       string
	launchCmd    []string // tokens after `--`; non-empty means a launch target
	allProcesses bool
	device       string
	output       string
	timeLimit    string
	maxDuration  string
	runName      string
	noPrompt     bool
	open         bool
	dryRun       bool
	human        bool
	// security gates
	allowLaunch         bool
	allowAllProcesses   bool
	allowExternalOutput bool
}

// recordSpec is the fully-resolved, post-validation set of values that
// buildRecordArgv turns into an xctrace argv. Pure input → pure output.
type recordSpec struct {
	template     string
	instruments  []string
	attach       string
	launchCmd    []string
	allProcesses bool
	device       string
	output       string // concrete .trace path
	timeLimit    string // effective, normalized to a single xctrace unit
	runName      string
	noPrompt     bool
}

// RecordReport is the structured output of `xcprof record`. The full command is
// always echoed so a human or agent can see exactly what was (or would be) run
// — transparency for a side-effecting operation (CLAUDE.md S-3).
type RecordReport struct {
	Tool        string   `json:"tool"`
	Version     string   `json:"version"`
	Action      string   `json:"action"`
	DryRun      bool     `json:"dry_run,omitempty"`
	Trace       string   `json:"trace,omitempty"`
	Preset      string   `json:"preset,omitempty"`
	Template    string   `json:"template,omitempty"`
	Instruments []string `json:"instruments,omitempty"`
	Target      string   `json:"target"`
	TargetMode  string   `json:"target_mode"` // attach | launch | all_processes — structured for agents
	TimeLimit   string   `json:"time_limit"`
	Command     []string `json:"command,omitempty"`
	OK          bool     `json:"ok"`
	Notes       []string `json:"notes,omitempty"`
	Problems    []string `json:"problems,omitempty"`
}

// stringList is a repeatable string flag (e.g. --instrument A --instrument B).
type stringList []string

func (s *stringList) String() string { return strings.Join(*s, ",") }
func (s *stringList) Set(v string) error {
	*s = append(*s, v)
	return nil
}

// runRecordCmd is indirected so tests can drive runRecord without spawning
// xctrace. Production points it at ExecRun against `xcrun`.
var runRecordCmd = func(ctx context.Context, timeout time.Duration, argv []string) (ExecResult, error) {
	return ExecRun(ctx, timeout, "xcrun", argv...)
}

// normalizeDuration renders a duration in a single unit xctrace accepts
// (`time[ms|s|m|h]`): whole seconds as Ns, otherwise milliseconds.
func normalizeDuration(d time.Duration) string {
	if d%time.Second == 0 {
		return fmt.Sprintf("%ds", d/time.Second)
	}
	return fmt.Sprintf("%dms", d.Milliseconds())
}

// effectiveTimeLimit resolves the recording's bounded duration. An unset
// request adopts the ceiling (recording is never unbounded); a request above
// the ceiling is refused.
func effectiveTimeLimit(timeLimit, maxDuration string) (string, error) {
	maxStr := strings.TrimSpace(maxDuration)
	if maxStr == "" {
		maxStr = defaultMaxDuration
	}
	maxD, err := time.ParseDuration(maxStr)
	if err != nil {
		return "", fmt.Errorf("invalid --max-duration %q: %w", maxStr, err)
	}
	if maxD <= 0 {
		return "", fmt.Errorf("--max-duration must be positive, got %q", maxStr)
	}
	req := strings.TrimSpace(timeLimit)
	if req == "" {
		return normalizeDuration(maxD), nil
	}
	reqD, err := time.ParseDuration(req)
	if err != nil {
		return "", fmt.Errorf("invalid --time-limit %q: %w", req, err)
	}
	if reqD <= 0 {
		return "", fmt.Errorf("--time-limit must be positive, got %q", req)
	}
	if reqD < time.Millisecond {
		return "", fmt.Errorf("--time-limit %q is below the 1ms resolution xctrace supports", req)
	}
	if reqD > maxD {
		return "", fmt.Errorf("--time-limit %s exceeds --max-duration %s (raise --max-duration to record longer)",
			normalizeDuration(reqD), normalizeDuration(maxD))
	}
	return normalizeDuration(reqD), nil
}

// pathWithin reports whether target is root or a descendant of it. root and
// target must already be absolute and cleaned. Guards against the
// sibling-prefix trap (/a/bc is not within /a/b).
func pathWithin(root, target string) bool {
	rel, err := filepath.Rel(root, target)
	if err != nil {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)))
}

// resolveSymlinks canonicalizes p by resolving symlinks in its longest existing
// prefix, then rejoining the non-existent remainder. (EvalSymlinks fails on a
// path that doesn't exist yet, which a to-be-created .trace always is, so we
// can't call it on the whole path.)
func resolveSymlinks(p string) string {
	if r, err := filepath.EvalSymlinks(p); err == nil {
		return r
	}
	dir := filepath.Dir(p)
	if dir == p { // reached the root; nothing left to resolve
		return p
	}
	return filepath.Join(resolveSymlinks(dir), filepath.Base(p))
}

// resolveTraceOutput decides the concrete .trace path and enforces the
// XCPROF_TRACE_ROOT sandbox. nowUnix seeds the generated filename so the
// function stays pure (runRecord passes time.Now().Unix()).
func resolveTraceOutput(output, cwd, root, label string, nowUnix int64, allowExternal bool) (string, error) {
	name := fmt.Sprintf("xcprof-%s-%d.trace", label, nowUnix)
	var p string
	switch {
	case strings.TrimSpace(output) == "":
		p = filepath.Join(root, name)
	default:
		if filepath.IsAbs(output) {
			p = filepath.Clean(output)
		} else {
			p = filepath.Clean(filepath.Join(cwd, output))
		}
		if !strings.HasSuffix(p, ".trace") {
			p = filepath.Join(p, name) // treat a non-.trace path as a directory
		}
	}
	// Containment is checked against the symlink-resolved forms of BOTH paths,
	// so a symlink planted inside the root can't smuggle the output out (and so
	// /tmp -> /private/tmp on macOS doesn't trigger a false refusal). The
	// user's original p is returned — it's been proven to land inside root.
	if !allowExternal && !pathWithin(resolveSymlinks(root), resolveSymlinks(p)) {
		return "", fmt.Errorf("--output %s resolves outside the trace sandbox %s; set XCPROF_TRACE_ROOT or pass --allow-external-output", p, root)
	}
	return p, nil
}

// resolveInstrumentation picks the single instrumentation source. Returns the
// template (if template mode), the instrument list (preset or explicit), and
// the preset name actually used ("" when template/explicit mode, for the
// report's preset field).
func resolveInstrumentation(o recordOpts) (template string, instruments []string, usedPreset string, err error) {
	sources := 0
	if o.preset != "" {
		sources++
	}
	if o.template != "" {
		sources++
	}
	if len(o.instruments) > 0 {
		sources++
	}
	if sources > 1 {
		return "", nil, "", fmt.Errorf("specify only one of --preset, --template, --instrument")
	}
	if o.template != "" {
		return o.template, nil, "", nil
	}
	if len(o.instruments) > 0 {
		return "", o.instruments, "", nil
	}
	preset := o.preset
	if preset == "" {
		preset = "cpu"
	}
	insts, ok := presetInstruments(preset)
	if !ok {
		return "", nil, "", fmt.Errorf("unknown preset %q (valid: %s)", preset, strings.Join(presetNames, ", "))
	}
	return "", insts, preset, nil
}

// validateTargets enforces the targeting rule (exactly one) and the launch /
// all-processes security gates.
func validateTargets(o recordOpts) error {
	var sel []string
	if o.allProcesses {
		sel = append(sel, "--all-processes")
	}
	if o.attach != "" {
		sel = append(sel, "--attach")
	}
	if len(o.launchCmd) > 0 {
		sel = append(sel, "--launch")
	}
	switch {
	case len(sel) == 0:
		return fmt.Errorf("a target is required: --attach <pid|name>, --all-processes, or -- <cmd> (launch)")
	case len(sel) > 1:
		return fmt.Errorf("choose one target, got %s", strings.Join(sel, " + "))
	}
	if len(o.launchCmd) > 0 && !o.allowLaunch {
		return fmt.Errorf("launching a process requires --allow-launch (it executes %q)", o.launchCmd[0])
	}
	if o.allProcesses && !o.allowAllProcesses {
		return fmt.Errorf("--all-processes requires --allow-all-processes (system-wide capture records unrelated apps)")
	}
	return nil
}

// buildRecordArgv assembles the xctrace argv (after `xcrun`). The launch target
// is emitted last because `--launch -- cmd` consumes the remainder of the line.
func buildRecordArgv(s recordSpec) []string {
	argv := []string{"xctrace", "record"}
	if s.template != "" {
		argv = append(argv, "--template", s.template)
	}
	for _, in := range s.instruments {
		argv = append(argv, "--instrument", in)
	}
	if s.output != "" {
		argv = append(argv, "--output", s.output)
	}
	if s.timeLimit != "" {
		argv = append(argv, "--time-limit", s.timeLimit)
	}
	if s.device != "" {
		argv = append(argv, "--device", s.device)
	}
	if s.runName != "" {
		argv = append(argv, "--run-name", s.runName)
	}
	if s.noPrompt {
		argv = append(argv, "--no-prompt")
	}
	switch {
	case s.allProcesses:
		argv = append(argv, "--all-processes")
	case s.attach != "":
		argv = append(argv, "--attach", s.attach)
	case len(s.launchCmd) > 0:
		argv = append(argv, "--launch", "--")
		argv = append(argv, s.launchCmd...)
	}
	return argv
}

// parseRecordArgs splits the launch command (everything after a standalone
// `--`) from the flags, then parses the flags. Bare positionals are rejected so
// a launch is always explicit (`-- <cmd>`). Returns the options and an exit
// code (0 ok, 2 usage error).
func parseRecordArgs(args []string) (recordOpts, int) {
	preDash := args
	var launchCmd []string
	for i, a := range args {
		if a == "--" {
			preDash = args[:i]
			launchCmd = args[i+1:]
			break
		}
	}

	fs := flag.NewFlagSet("record", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	preset := fs.String("preset", "", "instrument preset: "+strings.Join(presetNames, " / "))
	template := fs.String("template", "", "record with a single Instruments template (e.g. 'System Trace')")
	var instruments stringList
	fs.Var(&instruments, "instrument", "add an instrument by name (repeatable); overrides --preset")
	attach := fs.String("attach", "", "attach to a running process by pid or name")
	allProcesses := fs.Bool("all-processes", false, "record all processes system-wide (requires --allow-all-processes)")
	device := fs.String("device", "", "record on the named device or UDID (default: host)")
	output := fs.String("output", "", "output .trace path or directory (default: a generated name under XCPROF_TRACE_ROOT or cwd)")
	timeLimit := fs.String("time-limit", "", "recording duration, e.g. 30s or 500ms (capped by --max-duration; default: the cap)")
	maxDuration := fs.String("max-duration", defaultMaxDuration, "hard ceiling on recording duration")
	runName := fs.String("run-name", "", "name the run inside the trace")
	noPrompt := fs.Bool("no-prompt", false, "skip xctrace privacy prompts (required for non-interactive use)")
	open := fs.Bool("open", false, "open the trace in Instruments.app after recording")
	dryRun := fs.Bool("dry-run", false, "print the planned xctrace command without recording")
	human := fs.Bool("human", false, "human-readable output (default: compact JSON)")
	allowLaunch := fs.Bool("allow-launch", false, "permit launching a process (-- <cmd>)")
	allowAllProcesses := fs.Bool("allow-all-processes", false, "permit system-wide --all-processes capture")
	allowExternalOutput := fs.Bool("allow-external-output", false, "permit an --output path outside the trace sandbox")
	// Accept --json as a no-op alias of the default so callers can be explicit.
	_ = fs.Bool("json", false, "emit compact JSON (the default)")

	if err := fs.Parse(preDash); err != nil {
		return recordOpts{}, 2
	}
	if fs.NArg() > 0 {
		fmt.Fprintf(os.Stderr, "record: unexpected argument %q (launch commands go after `--`)\n", fs.Arg(0))
		return recordOpts{}, 2
	}

	return recordOpts{
		preset:              *preset,
		template:            *template,
		instruments:         instruments,
		attach:              *attach,
		launchCmd:           launchCmd,
		allProcesses:        *allProcesses,
		device:              *device,
		output:              *output,
		timeLimit:           *timeLimit,
		maxDuration:         *maxDuration,
		runName:             *runName,
		noPrompt:            *noPrompt,
		open:                *open,
		dryRun:              *dryRun,
		human:               *human,
		allowLaunch:         *allowLaunch,
		allowAllProcesses:   *allowAllProcesses,
		allowExternalOutput: *allowExternalOutput,
	}, 0
}

func targetLabel(o recordOpts) string {
	switch {
	case o.allProcesses:
		return "all-processes"
	case o.attach != "":
		return "attach:" + o.attach
	case len(o.launchCmd) > 0:
		return "launch:" + strings.Join(o.launchCmd, " ")
	default:
		return ""
	}
}

// targetMode is the machine-readable counterpart to targetLabel — a stable enum
// (attach | launch | all_processes) agents can key on without parsing the
// display string.
func targetMode(o recordOpts) string {
	switch {
	case o.allProcesses:
		return "all_processes"
	case o.attach != "":
		return "attach"
	case len(o.launchCmd) > 0:
		return "launch"
	default:
		return ""
	}
}

func runRecord(out io.Writer, args []string) int {
	o, code := parseRecordArgs(args)
	if code != 0 {
		return code
	}
	if err := validateTargets(o); err != nil {
		fmt.Fprintln(os.Stderr, "record:", err)
		return 2
	}
	template, instruments, usedPreset, err := resolveInstrumentation(o)
	if err != nil {
		fmt.Fprintln(os.Stderr, "record:", err)
		return 2
	}
	limit, err := effectiveTimeLimit(o.timeLimit, o.maxDuration)
	if err != nil {
		fmt.Fprintln(os.Stderr, "record:", err)
		return 2
	}

	cwd, _ := os.Getwd()
	root := strings.TrimSpace(os.Getenv("XCPROF_TRACE_ROOT"))
	if root == "" {
		root = cwd
	} else if abs, aerr := filepath.Abs(root); aerr == nil {
		root = abs
	}
	label := usedPreset
	if label == "" {
		label = "record"
	}
	outPath, err := resolveTraceOutput(o.output, cwd, root, label, time.Now().Unix(), o.allowExternalOutput)
	if err != nil {
		fmt.Fprintln(os.Stderr, "record:", err)
		return 2
	}

	spec := recordSpec{
		template:     template,
		instruments:  instruments,
		attach:       o.attach,
		launchCmd:    o.launchCmd,
		allProcesses: o.allProcesses,
		device:       o.device,
		output:       outPath,
		timeLimit:    limit,
		runName:      o.runName,
		noPrompt:     o.noPrompt,
	}
	argv := buildRecordArgv(spec)

	rep := RecordReport{
		Tool:        "xcprof",
		Version:     version,
		Action:      "record",
		DryRun:      o.dryRun,
		Trace:       outPath,
		Preset:      usedPreset,
		Template:    template,
		Instruments: instruments,
		Target:      targetLabel(o),
		TargetMode:  targetMode(o),
		TimeLimit:   limit,
		Command:     append([]string{"xcrun"}, argv...),
	}

	if o.dryRun {
		rep.OK = true
		return writeRecord(out, rep, o.human)
	}

	// Refuse to record onto an existing trace. xctrace itself errors (it wants
	// --append-run), but checking up front gives a clear message AND makes the
	// post-run "trace exists == success" check best-effort honest: a fresh
	// record means the bundle didn't exist a moment ago, so finding it
	// afterward is (barring a racing writer in the sandbox) genuine success.
	if _, err := os.Stat(outPath); err == nil {
		fmt.Fprintf(os.Stderr, "record: output trace already exists at %s (remove it or choose another --output)\n", outPath)
		return 2
	}

	if err := os.MkdirAll(filepath.Dir(outPath), 0o755); err != nil {
		fmt.Fprintln(os.Stderr, "record: create output directory:", err)
		return 2
	}

	ctx := context.Background()
	limitD, _ := time.ParseDuration(limit) // limit is normalized; parse can't fail
	res, runErr := runRecordCmd(ctx, limitD+recordExecGrace, argv)

	// Ground truth is the saved trace, not xctrace's exit code: a `--launch`
	// recording terminated at the time limit returns the killed target's exit
	// status (e.g. 54), yet writes a perfectly valid trace. Trust the bundle.
	fi, statErr := os.Stat(outPath)
	traceCreated := statErr == nil && fi.IsDir()

	if !traceCreated {
		rep.OK = false
		if runErr != nil {
			rep.Problems = append(rep.Problems, runErr.Error())
		} else {
			rep.Problems = append(rep.Problems, "xctrace exited cleanly but no trace was written at "+outPath)
		}
		if s := strings.TrimSpace(string(res.Stderr)); s != "" {
			rep.Problems = append(rep.Problems, s)
		}
		_ = writeRecord(out, rep, o.human)
		return 2
	}

	rep.OK = true
	switch {
	case IsTimeoutError(runErr):
		rep.Notes = append(rep.Notes,
			"recording exceeded the exec budget and was terminated; the saved trace may be incomplete")
	case runErr != nil:
		rep.Notes = append(rep.Notes,
			"xctrace returned a non-zero exit ("+runErr.Error()+") but the trace was saved; this is expected when a launched target is terminated at the time limit")
	}
	// A saved bundle can still be unfinalized (interrupted recording) or
	// memory/energy-only, so `export --toc` — the same probe analyze uses —
	// finds nothing to export. Surface that honestly rather than let a bare
	// ok:true imply a trace the rest of the toolchain can read.
	if _, terr := exportTOC(ctx, outPath); isMissingExportableTables(terr) {
		rep.Notes = append(rep.Notes,
			"the saved trace has no xctrace-exportable tables (interrupted/unfinalized recording, or a memory/energy-only capture); `xcprof analyze` can't read it — open it in Instruments.app")
	}
	if o.open {
		_, _ = ExecRun(ctx, 0, "open", outPath)
	}
	return writeRecord(out, rep, o.human)
}

// writeRecord emits the report as compact JSON (default, LLM-lean) or a terse
// human summary. Returns 8 on an output-write error, else 0.
func writeRecord(out io.Writer, rep RecordReport, human bool) int {
	if human {
		fmt.Fprintf(out, "xcprof record ok=%v%s\n", rep.OK, dryRunSuffix(rep.DryRun))
		if rep.Preset != "" {
			fmt.Fprintf(out, "  preset: %s\n", rep.Preset)
		}
		if rep.Template != "" {
			fmt.Fprintf(out, "  template: %s\n", rep.Template)
		}
		if len(rep.Instruments) > 0 {
			fmt.Fprintf(out, "  instruments: %s\n", strings.Join(rep.Instruments, ", "))
		}
		fmt.Fprintf(out, "  target: %s · time-limit: %s\n", rep.Target, rep.TimeLimit)
		fmt.Fprintf(out, "  trace: %s\n", rep.Trace)
		fmt.Fprintf(out, "  command: %s\n", strings.Join(rep.Command, " "))
		for _, n := range rep.Notes {
			fmt.Fprintf(out, "  note: %s\n", n)
		}
		for _, p := range rep.Problems {
			fmt.Fprintf(out, "  - %s\n", p)
		}
		return 0
	}
	enc := json.NewEncoder(out) // compact
	if err := enc.Encode(rep); err != nil {
		fmt.Fprintln(os.Stderr, "record: write output:", err)
		return 8
	}
	return 0
}

func dryRunSuffix(dry bool) string {
	if dry {
		return " (dry-run)"
	}
	return ""
}
