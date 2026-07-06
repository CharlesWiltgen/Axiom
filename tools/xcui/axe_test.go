package main

import (
	"os"
	"path/filepath"
	"testing"
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

func TestResolveAxeDeveloperDir(t *testing.T) {
	selectedOK := mkXcode(t, true)
	betaNoFW := mkXcode(t, false)
	stableFW := mkXcode(t, true)
	otherNoFW := mkXcode(t, false)

	// Selected Xcode already has the framework → no override.
	if dir, on := resolveAxeDeveloperDir(selectedOK, []string{stableFW}); on || dir != "" {
		t.Errorf("no override expected, got (%q,%v)", dir, on)
	}
	// Selected missing it, a candidate has it → override to that candidate.
	if dir, on := resolveAxeDeveloperDir(betaNoFW, []string{betaNoFW, stableFW}); !on || dir != stableFW {
		t.Errorf("override to %s expected, got (%q,%v)", stableFW, dir, on)
	}
	// Selected missing it, no candidate has it → cannot fix.
	if dir, on := resolveAxeDeveloperDir(betaNoFW, []string{otherNoFW}); on || dir != "" {
		t.Errorf("no fixable override expected, got (%q,%v)", dir, on)
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
	// Framework named but neither marker present → not our error.
	if isSimulatorKitLoadError("linked against SimulatorKit.framework") {
		t.Error("expected false for framework named without a load-failure marker")
	}
}
