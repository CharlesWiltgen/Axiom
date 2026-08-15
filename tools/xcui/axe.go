package main

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// simulatorKitRelPath is the legacy home of SimulatorKit.framework:
// <DEVELOPER_DIR>/Library/PrivateFrameworks/. Xcode 27 relocated it to
// <app>/Contents/SharedFrameworks/.
//
// This is now only used to pick a RECOVERY toolchain after AXe has already failed —
// never to predict whether it will. AXe 1.8.0 locates the framework at its Xcode 27
// home unaided, so the relocation alone no longer implies breakage.
const simulatorKitRelPath = "Library/PrivateFrameworks/SimulatorKit.framework"

// axeFrameworkPresent reports whether developerDir carries SimulatorKit.framework
// at the path AXe expects.
func axeFrameworkPresent(developerDir string) bool {
	if developerDir == "" {
		return false
	}
	_, err := os.Stat(filepath.Join(developerDir, simulatorKitRelPath))
	return err == nil
}

// axeFallbackDeveloperDir picks a DEVELOPER_DIR to retry AXe under, AFTER a bare
// run has already failed to load SimulatorKit. It returns the first candidate other
// than the current one that carries the framework at the legacy path, or ("", false).
//
// It deliberately does NOT short-circuit when currentDeveloperDir has the framework:
// by the time this is called we have direct evidence that running under the current
// selection fails, which outranks any inference from the filesystem layout.
func axeFallbackDeveloperDir(currentDeveloperDir string, candidates []string) (dir string, overridden bool) {
	for _, c := range candidates {
		if c != "" && c != currentDeveloperDir && axeFrameworkPresent(c) {
			return c, true
		}
	}
	return "", false
}

// isSimulatorKitLoadError reports whether AXe stderr shows a SimulatorKit load
// failure. This is now the load-bearing signal — the whole decision hangs on it —
// so it tracks every wording AXe has used.
//
// AXe reworded this between the version this file was written for and 1.8.0:
//
//	old: "Failed to load essential private frameworks: Attempting to load a file
//	      at path '…SimulatorKit.framework', but it does not exist"
//	1.8.0: "AXe could not load simulator support from the selected Xcode
//	        installation: Attempting to load a file at path '…', but it does not exist"
//
// The shared "does not exist" tail is what kept the detector working across that
// change; both headline phrasings are matched explicitly so it does not rest on one
// incidental substring.
func isSimulatorKitLoadError(stderr string) bool {
	return strings.Contains(stderr, "SimulatorKit.framework") &&
		(strings.Contains(stderr, "does not exist") ||
			strings.Contains(stderr, "Failed to load essential private frameworks") ||
			strings.Contains(stderr, "could not load simulator support"))
}

// axeDeveloperDirCandidates lists fallback DEVELOPER_DIRs to try when the selected
// Xcode relocated SimulatorKit.framework. Release Xcode.app goes first (it keeps the
// legacy path), then any other Xcode*.app install. Deduped — the glob also matches
// Xcode.app.
func axeDeveloperDirCandidates() []string {
	seen := map[string]bool{}
	var out []string
	add := func(p string) {
		if p != "" && !seen[p] {
			seen[p] = true
			out = append(out, p)
		}
	}
	add("/Applications/Xcode.app/Contents/Developer")
	matches, _ := filepath.Glob("/Applications/Xcode*.app/Contents/Developer")
	for _, m := range matches {
		add(m)
	}
	return out
}

// currentDeveloperDir reports the active toolchain using Apple's own precedence:
// $DEVELOPER_DIR outranks the xcode-select selection for xcrun and friends. Reading
// only `xcode-select -p` measured the wrong thing and left a caller who had exported
// DEVELOPER_DIR unable to influence — or opt out of — xcui's decision.
func currentDeveloperDir() string {
	if dir := strings.TrimSpace(os.Getenv("DEVELOPER_DIR")); dir != "" {
		return dir
	}
	p, err := exec.LookPath("xcode-select")
	if err != nil {
		return ""
	}
	res, err := ExecRun(context.Background(), 0, p, "-p")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(res.Stdout))
}

// The DEVELOPER_DIR override AXe may need, decided REACTIVELY and memoized for the
// process. Only a conclusive outcome is recorded, so an unrelated failure (no booted
// sim, bad args) leaves the question open for the next call.
//
// This used to be predictive: stat the selected Xcode for SimulatorKit.framework at
// the legacy path and pre-emptively pin an older Xcode if it was missing. That was
// right when written (2026-07-06) and wrong by 2026-08-15 — AXe 1.8.0 finds the
// framework at its Xcode 27 home (Contents/SharedFrameworks) unaided, so the override
// fired when nothing needed fixing, silently downgraded the toolchain AXe ran under,
// and made `doctor` assert that bare `axe` fails when it demonstrably does not.
//
// Predicting a third-party tool's search path from the outside is what dated. The
// question is not where the framework is, it is whether AXe can find it — so ask AXe.
// A reactive check retires itself the day the upstream bug is fixed, with no version
// table to maintain.
var (
	axeOverrideMu    sync.Mutex
	axeOverrideKnown bool
	axeOverrideDir   string
	axeOverrideOn    bool
)

func axeOverrideCached() (dir string, on bool, known bool) {
	axeOverrideMu.Lock()
	defer axeOverrideMu.Unlock()
	return axeOverrideDir, axeOverrideOn, axeOverrideKnown
}

func recordAxeOverride(dir string, on bool) {
	axeOverrideMu.Lock()
	defer axeOverrideMu.Unlock()
	axeOverrideDir, axeOverrideOn, axeOverrideKnown = dir, on, true
}

// axeDeveloperDirOverride reports the override in force, and whether it has been
// decided yet. Callers that only want to describe the state (doctor) must not
// trigger a probe, so this never runs AXe itself.
func axeDeveloperDirOverride() (dir string, overridden bool, decided bool) {
	return axeOverrideCached()
}

// axeExec is the seam the retry logic is tested through. On a machine where AXe
// already works the reactive path cannot be reached end-to-end — pointing
// DEVELOPER_DIR at a broken tree also breaks simulator discovery, so the smoke test
// never runs — and an untested retry is how the last workaround rotted unnoticed.
var axeExec = ExecRunEnv

// runAxe invokes the `axe` CLI. It runs bare first; only if AXe reports the
// SimulatorKit load failure does it find a fallback DEVELOPER_DIR and retry once,
// caching that decision for the process. Cost on an affected setup is one failed
// invocation; cost on a healthy setup is nothing.
func runAxe(ctx context.Context, timeout time.Duration, args ...string) (ExecResult, error) {
	if dir, on, known := axeOverrideCached(); known {
		var env []string
		if on {
			env = []string{"DEVELOPER_DIR=" + dir}
		}
		return axeExec(ctx, timeout, env, "axe", args...)
	}

	res, err := axeExec(ctx, timeout, nil, "axe", args...)
	if err == nil {
		recordAxeOverride("", false)
		return res, nil
	}
	if !isSimulatorKitLoadError(string(res.Stderr)) {
		// Inconclusive about SimulatorKit — don't memoize a verdict off an
		// unrelated failure, or a single bad invocation would pin the answer.
		return res, err
	}

	fallback, ok := axeFallbackDeveloperDir(currentDeveloperDir(), axeDeveloperDirCandidates())
	if !ok {
		// Conclusive: AXe can't load SimulatorKit and nothing on this machine
		// fixes it. Record it so every later call doesn't re-probe.
		recordAxeOverride("", false)
		return res, err
	}
	// Record only AFTER the retry is observed to work. axeFallbackDeveloperDir just
	// stats a path, so a candidate can carry the legacy framework directory and still
	// fail to run AXe (a stale CoreSimulator against a newer booted runtime, or a
	// second broken install). Recording first pinned that DEVELOPER_DIR for the whole
	// process, so every later call — doctor's remaining probes, voiceover traverse,
	// a resize sweep's assertions — ran under a toolchain already seen to fail, and
	// made doctor report "no fallback Xcode was found" when one was found and tried.
	retried, rerr := axeExec(ctx, timeout, []string{"DEVELOPER_DIR=" + fallback}, "axe", args...)
	if rerr != nil {
		// Inconclusive: leave the question open rather than pin a broken answer.
		return retried, rerr
	}
	recordAxeOverride(fallback, true)
	return retried, nil
}
