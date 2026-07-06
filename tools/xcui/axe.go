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

// simulatorKitRelPath is where AXe (like CoreSimulator historically) looks for
// SimulatorKit.framework: <DEVELOPER_DIR>/Library/PrivateFrameworks/. Xcode 27
// beta relocated it to <app>/Contents/SharedFrameworks/, so a beta DEVELOPER_DIR
// no longer has it here and bare `axe` fails with "Failed to load essential
// private frameworks … SimulatorKit.framework … does not exist".
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

// resolveAxeDeveloperDir decides whether AXe needs a DEVELOPER_DIR override to
// find SimulatorKit.framework. If the selected Xcode already has it, no override
// is needed ("", false). Otherwise it returns the first candidate DEVELOPER_DIR
// that carries it (dir, true), or ("", false) when none do.
func resolveAxeDeveloperDir(currentDeveloperDir string, candidates []string) (dir string, overridden bool) {
	if axeFrameworkPresent(currentDeveloperDir) {
		return "", false
	}
	for _, c := range candidates {
		if c != "" && c != currentDeveloperDir && axeFrameworkPresent(c) {
			return c, true
		}
	}
	return "", false
}

// isSimulatorKitLoadError reports whether AXe stderr shows the SimulatorKit load
// failure caused by the Xcode-27-beta framework relocation.
func isSimulatorKitLoadError(stderr string) bool {
	return strings.Contains(stderr, "SimulatorKit.framework") &&
		(strings.Contains(stderr, "does not exist") ||
			strings.Contains(stderr, "Failed to load essential private frameworks"))
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

func currentDeveloperDir() string {
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

// axeOverride is resolved once per process: the DEVELOPER_DIR (if any) AXe needs
// so it can locate SimulatorKit.framework under an Xcode that relocated it.
var (
	axeOverrideOnce sync.Once
	axeOverrideDir  string
	axeOverrideOn   bool
)

// axeDeveloperDirOverride is the impure, process-memoized wrapper over the pure
// resolveAxeDeveloperDir. It reads the live machine (xcode-select + the /Applications
// glob) and is deliberately left untested — the testable logic lives in the pure
// functions above (see axe_test.go).
func axeDeveloperDirOverride() (dir string, overridden bool) {
	axeOverrideOnce.Do(func() {
		axeOverrideDir, axeOverrideOn = resolveAxeDeveloperDir(currentDeveloperDir(), axeDeveloperDirCandidates())
	})
	return axeOverrideDir, axeOverrideOn
}

// runAxe invokes the `axe` CLI, injecting DEVELOPER_DIR when the selected Xcode
// relocated SimulatorKit.framework (Xcode 27 beta) so taps/describe-ui still work.
func runAxe(ctx context.Context, timeout time.Duration, args ...string) (ExecResult, error) {
	var env []string
	if dir, on := axeDeveloperDirOverride(); on {
		env = []string{"DEVELOPER_DIR=" + dir}
	}
	return ExecRunEnv(ctx, timeout, env, "axe", args...)
}
