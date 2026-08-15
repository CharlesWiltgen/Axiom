package main

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// mkXcode builds a temp <root>/Contents/Developer, optionally seeding the legacy
// SimulatorKit.framework path AXe looks for. Returns the Developer dir.
func mkXcode(t *testing.T, withFramework bool) string {
	t.Helper()
	dev := filepath.Join(t.TempDir(), "Contents", "Developer")
	target := dev
	if withFramework {
		target = filepath.Join(dev, simulatorKitRelPath)
	}
	if err := os.MkdirAll(target, 0o755); err != nil {
		t.Fatal(err)
	}
	return dev
}

func TestAxeFrameworkPresent(t *testing.T) {
	if !axeFrameworkPresent(mkXcode(t, true)) {
		t.Error("expected framework present")
	}
	if axeFrameworkPresent(mkXcode(t, false)) {
		t.Error("expected framework absent")
	}
	if axeFrameworkPresent("") {
		t.Error("empty developer dir must be absent")
	}
}

func TestAxeFallbackDeveloperDir(t *testing.T) {
	betaNoFW := mkXcode(t, false)
	stableFW := mkXcode(t, true)
	otherNoFW := mkXcode(t, false)

	// A candidate has the framework → retry under it.
	if dir, on := axeFallbackDeveloperDir(betaNoFW, []string{betaNoFW, stableFW}); !on || dir != stableFW {
		t.Errorf("fallback to %s expected, got (%q,%v)", stableFW, dir, on)
	}
	// No candidate has it → nothing on this machine fixes it.
	if dir, on := axeFallbackDeveloperDir(betaNoFW, []string{otherNoFW}); on || dir != "" {
		t.Errorf("no fixable fallback expected, got (%q,%v)", dir, on)
	}
	// The current dir is never returned: it is the one that just failed.
	if dir, on := axeFallbackDeveloperDir(stableFW, []string{stableFW}); on || dir != "" {
		t.Errorf("current dir must not be offered as its own fallback, got (%q,%v)", dir, on)
	}
	// Crucially NOT short-circuited by the current dir having the framework. The
	// predictive version returned ("",false) here, which in the reactive flow would
	// mean "AXe failed and we decline to try anything" — the caller is only here
	// because a bare run already failed.
	if dir, on := axeFallbackDeveloperDir(stableFW, []string{stableFW, otherNoFW, mkXcode(t, true)}); !on || dir == "" {
		t.Errorf("a usable fallback must be offered even when the current dir looks fine, got (%q,%v)", dir, on)
	}
}

func TestCurrentDeveloperDirHonoursEnv(t *testing.T) {
	// Apple's precedence: DEVELOPER_DIR outranks the xcode-select selection. Without
	// this, a caller exporting DEVELOPER_DIR could not influence or opt out of xcui's
	// decision, because xcui measured a different toolchain than the one in force.
	want := "/Applications/Xcode-beta.app/Contents/Developer"
	t.Setenv("DEVELOPER_DIR", want)
	if got := currentDeveloperDir(); got != want {
		t.Errorf("currentDeveloperDir() = %q, want the exported DEVELOPER_DIR %q", got, want)
	}

	// Whitespace-only is treated as unset, not as a real selection.
	t.Setenv("DEVELOPER_DIR", "   ")
	if got := currentDeveloperDir(); got == "   " {
		t.Error("blank DEVELOPER_DIR must not be taken as a selection")
	}
}

func TestAxeOverrideMemoIsConclusiveOnly(t *testing.T) {
	reset := func() {
		axeOverrideMu.Lock()
		defer axeOverrideMu.Unlock()
		axeOverrideKnown, axeOverrideDir, axeOverrideOn = false, "", false
	}
	t.Cleanup(reset)

	reset()
	if _, _, known := axeDeveloperDirOverride(); known {
		t.Error("override must start undecided so doctor cannot report a verdict it never measured")
	}

	recordAxeOverride("/some/dir", true)
	dir, on, known := axeDeveloperDirOverride()
	if !known || !on || dir != "/some/dir" {
		t.Errorf("recorded override not readable back: (%q,%v,%v)", dir, on, known)
	}

	reset()
	recordAxeOverride("", false)
	if _, on, known := axeDeveloperDirOverride(); !known || on {
		t.Error(`a recorded "no override needed" must read back as decided-and-off, not undecided`)
	}
}

func TestIsSimulatorKitLoadError(t *testing.T) {
	real := `Error: CLIError(errorDescription: "Failed to load essential private frameworks: ` +
		`Attempting to load a file at path '/Applications/Xcode-beta.app/Contents/Developer/` +
		`Library/PrivateFrameworks/SimulatorKit.framework', but it does not exist")`
	if !isSimulatorKitLoadError(real) {
		t.Error("expected true for the real SimulatorKit relocation error")
	}
	if isSimulatorKitLoadError("axe: some unrelated failure") {
		t.Error("expected false for an unrelated error")
	}
	if isSimulatorKitLoadError("") {
		t.Error("expected false for empty stderr")
	}
	// Each OR-branch in isolation (framework name + exactly one marker).
	if !isSimulatorKitLoadError("…SimulatorKit.framework', but it does not exist") {
		t.Error("expected true for framework + 'does not exist' alone")
	}
	if !isSimulatorKitLoadError("Failed to load essential private frameworks: …SimulatorKit.framework") {
		t.Error("expected true for framework + 'Failed to load…' alone")
	}
	// AXe 1.8.0's rewording, captured verbatim on 2026-08-15 by pointing
	// DEVELOPER_DIR at a tree with no SimulatorKit. The old headline phrase is gone;
	// only the shared "does not exist" tail kept the detector alive across it.
	axe180 := `Error: AXe could not load simulator support from the selected Xcode installation: ` +
		`Attempting to load a file at path '/tmp/fake-xcode/Contents/Developer/Library/` +
		`PrivateFrameworks/SimulatorKit.framework', but it does not exist`
	if !isSimulatorKitLoadError(axe180) {
		t.Error("expected true for AXe 1.8.0's rewording of the SimulatorKit load failure")
	}
	if !isSimulatorKitLoadError("could not load simulator support …SimulatorKit.framework") {
		t.Error("expected true for framework + the 1.8.0 headline alone")
	}
	// Framework named but neither marker present → not our error.
	if isSimulatorKitLoadError("linked against SimulatorKit.framework") {
		t.Error("expected false for framework named without a load-failure marker")
	}
}

// axeCall records one invocation made through the axeExec seam.
type axeCall struct {
	env  []string
	args []string
}

// withFakeAxe swaps the exec seam for a scripted sequence of results and returns the
// recorded calls. Each entry in results answers the next invocation in order.
func withFakeAxe(t *testing.T, results []struct {
	stderr string
	err    error
}) *[]axeCall {
	t.Helper()
	calls := &[]axeCall{}
	orig := axeExec
	i := 0
	axeExec = func(ctx context.Context, timeout time.Duration, env []string, name string, args ...string) (ExecResult, error) {
		*calls = append(*calls, axeCall{env: env, args: args})
		if i >= len(results) {
			t.Fatalf("unexpected extra AXe invocation #%d", i+1)
		}
		r := results[i]
		i++
		return ExecResult{Stderr: []byte(r.stderr)}, r.err
	}
	t.Cleanup(func() {
		axeExec = orig
		axeOverrideMu.Lock()
		axeOverrideKnown, axeOverrideDir, axeOverrideOn = false, "", false
		axeOverrideMu.Unlock()
	})
	axeOverrideMu.Lock()
	axeOverrideKnown, axeOverrideDir, axeOverrideOn = false, "", false
	axeOverrideMu.Unlock()
	return calls
}

type axeResult = struct {
	stderr string
	err    error
}

func TestRunAxeRunsBareWhenAxeWorks(t *testing.T) {
	calls := withFakeAxe(t, []axeResult{{"", nil}})

	if _, err := runAxe(context.Background(), time.Second, "describe-ui"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(*calls) != 1 {
		t.Fatalf("expected exactly 1 invocation, got %d", len(*calls))
	}
	if (*calls)[0].env != nil {
		t.Errorf("healthy AXe must run with no DEVELOPER_DIR override, got env %v", (*calls)[0].env)
	}
	// And the verdict sticks: the second call must not re-probe.
	if _, on, known := axeDeveloperDirOverride(); !known || on {
		t.Errorf("expected a recorded no-override verdict, got (on=%v, known=%v)", on, known)
	}
}

func TestRunAxeDoesNotMemoizeUnrelatedFailures(t *testing.T) {
	withFakeAxe(t, []axeResult{{"axe: no such device", errors.New("exit 1")}})

	if _, err := runAxe(context.Background(), time.Second, "describe-ui"); err == nil {
		t.Fatal("expected the unrelated failure to propagate")
	}
	// A bad invocation must not pin the answer for the whole process.
	if _, _, known := axeDeveloperDirOverride(); known {
		t.Error("an unrelated AXe failure must leave the SimulatorKit question undecided")
	}
}

func TestRunAxeRetriesOnceUnderFallbackAfterSimulatorKitError(t *testing.T) {
	// Both AXe wordings must drive the retry, including the 1.8.0 rewording that the
	// original detector was not written against.
	for _, stderr := range []string{
		`Failed to load essential private frameworks: Attempting to load a file at path '/Applications/Xcode-beta.app/Contents/Developer/Library/PrivateFrameworks/SimulatorKit.framework', but it does not exist`,
		`AXe could not load simulator support from the selected Xcode installation: Attempting to load a file at path '/x/SimulatorKit.framework', but it does not exist`,
	} {
		t.Run(firstLine(stderr)[:24], func(t *testing.T) {
			calls := withFakeAxe(t, []axeResult{{stderr, errors.New("exit 1")}, {"", nil}})

			if _, err := runAxe(context.Background(), time.Second, "describe-ui"); err != nil {
				// Only meaningful on a machine that HAS a fallback Xcode; skip otherwise.
				if _, ok := axeFallbackDeveloperDir(currentDeveloperDir(), axeDeveloperDirCandidates()); !ok {
					t.Skip("no fallback Xcode with the legacy SimulatorKit path on this machine")
				}
				t.Fatalf("retry should have succeeded: %v", err)
			}
			if len(*calls) != 2 {
				t.Fatalf("expected bare attempt + 1 retry, got %d invocations", len(*calls))
			}
			if (*calls)[0].env != nil {
				t.Error("the first attempt must be bare")
			}
			if len((*calls)[1].env) != 1 || !strings.HasPrefix((*calls)[1].env[0], "DEVELOPER_DIR=") {
				t.Errorf("the retry must carry a DEVELOPER_DIR override, got %v", (*calls)[1].env)
			}
			// Decision cached: a later call goes straight to the override, no re-probe.
			if _, on, known := axeDeveloperDirOverride(); !known || !on {
				t.Errorf("expected a recorded override, got (on=%v, known=%v)", on, known)
			}
		})
	}
}

func TestRunAxeDoesNotPinAFallbackThatAlsoFails(t *testing.T) {
	// axeFallbackDeveloperDir only STATS a path, so a candidate can carry the legacy
	// SimulatorKit directory and still fail to run AXe (stale CoreSimulator against a
	// newer booted runtime, or a second broken install). Recording before observing
	// the retry pinned that DEVELOPER_DIR for the whole process, so every later call
	// ran under a toolchain already seen to fail.
	simKitErr := `Failed to load essential private frameworks: '/x/SimulatorKit.framework', but it does not exist`
	calls := withFakeAxe(t, []axeResult{
		{simKitErr, errors.New("exit 1")},      // bare attempt
		{"still broken", errors.New("exit 1")}, // retry under the fallback ALSO fails
	})

	if _, err := runAxe(context.Background(), time.Second, "describe-ui"); err == nil {
		if _, ok := axeFallbackDeveloperDir(currentDeveloperDir(), axeDeveloperDirCandidates()); !ok {
			t.Skip("no fallback Xcode on this machine")
		}
		t.Fatal("expected the failed retry to propagate")
	}
	if len(*calls) != 2 {
		if len(*calls) == 1 {
			t.Skip("no fallback Xcode on this machine — retry never attempted")
		}
		t.Fatalf("expected bare + 1 retry, got %d", len(*calls))
	}
	if _, on, known := axeDeveloperDirOverride(); known || on {
		t.Errorf("a fallback whose retry FAILED must not be pinned; got (on=%v, known=%v)", on, known)
	}
}
