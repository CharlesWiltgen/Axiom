package main

import (
	"bytes"
	"strings"
	"testing"
	"time"
)

func TestHasFlag(t *testing.T) {
	cases := []struct {
		args []string
		want bool
		why  string
	}{
		{[]string{"--udid", "ABC"}, true, "space-separated form"},
		{[]string{"--udid=ABC"}, true, "equals form"},
		{[]string{"--id", "btn"}, false, "different flag"},
		{nil, false, "no args"},
		// Must not match on a prefix: --udid-file is a different flag, and treating it
		// as --udid would skip injecting the real one.
		{[]string{"--udid-file", "f"}, false, "longer flag sharing the prefix"},
	}
	for _, c := range cases {
		if got := hasFlag(c.args, "--udid"); got != c.want {
			t.Errorf("hasFlag(%v) = %v, want %v (%s)", c.args, got, c.want, c.why)
		}
	}
}

func TestInputVerbsDoNotShadowXcuiCommands(t *testing.T) {
	// main dispatches its own verbs first, but a collision would still be a trap for
	// a reader. xcui's own commands must never appear in the passthrough table.
	for _, own := range []string{"doctor", "wait", "assert", "a11y", "dialog", "voiceover"} {
		if _, clash := axeInputVerbs[own]; clash {
			t.Errorf("%q is both an xcui command and a forwarded AXe verb", own)
		}
	}
	// describe-ui / list-simulators are deliberately NOT forwarded: xcui reads the
	// tree and resolves the sim itself.
	for _, excluded := range []string{"describe-ui", "list-simulators", "init"} {
		if _, present := axeInputVerbs[excluded]; present {
			t.Errorf("%q must not be forwarded — xcui owns that job", excluded)
		}
	}
}

func TestRunInputForwardsNonTapVerbVerbatim(t *testing.T) {
	// The whole point of the passthrough: input goes through runAxe, so it inherits
	// the SimulatorKit fallback. Assert the call actually lands there, with the verb
	// first and the caller's args untouched after it. `tap` is the one verb xcui
	// adds a flag to — TestRunInputTapStyle covers that.
	calls := withFakeAxe(t, []axeResult{{"", nil}})

	var out bytes.Buffer
	code := runInput(&out, "type", []string{"--udid", "SIM-1", "user@example.com"})
	if code != 0 {
		t.Fatalf("exit = %d, want 0", code)
	}
	if len(*calls) != 1 {
		t.Fatalf("expected 1 AXe invocation, got %d", len(*calls))
	}
	got := strings.Join((*calls)[0].args, " ")
	if got != "type --udid SIM-1 user@example.com" {
		t.Errorf("forwarded args = %q, want the verb followed by argv verbatim", got)
	}
}

func TestRunInputTapStyle(t *testing.T) {
	// AXe's default tap style sends FBSimulator tapAt, which activated no SwiftUI
	// control tested on Xcode 27.1 + AXe 1.8.0 while still printing "✓ … completed
	// successfully"; --tap-style physical activated all of them. So xcui supplies
	// physical when the caller chose nothing, and never overrides a caller's choice.
	// Only `tap` takes the flag — AXe rejects it on every other verb.
	cases := []struct {
		verb string
		args []string
		want string
		why  string
	}{
		{"tap", []string{"--udid", "SIM-1", "--id", "cta"},
			"tap --tap-style physical --udid SIM-1 --id cta", "omitted style becomes physical"},
		{"tap", []string{"--udid", "SIM-1", "--tap-style", "simulator", "--id", "cta"},
			"tap --udid SIM-1 --tap-style simulator --id cta", "caller's style is forwarded untouched"},
		{"tap", []string{"--udid", "SIM-1", "--tap-style=automatic", "-x", "1", "-y", "2"},
			"tap --udid SIM-1 --tap-style=automatic -x 1 -y 2", "equals form counts as a choice"},
		{"swipe", []string{"--udid", "SIM-1", "--start-x", "1", "--start-y", "2", "--end-x", "3", "--end-y", "4"},
			"swipe --udid SIM-1 --start-x 1 --start-y 2 --end-x 3 --end-y 4", "non-tap verbs get no tap style"},
	}
	for _, c := range cases {
		calls := withFakeAxe(t, []axeResult{{"", nil}})
		var out bytes.Buffer
		if code := runInput(&out, c.verb, c.args); code != 0 {
			t.Fatalf("%s: exit = %d, want 0", c.why, code)
		}
		if len(*calls) != 1 {
			t.Fatalf("%s: expected 1 AXe invocation, got %d", c.why, len(*calls))
		}
		if got := strings.Join((*calls)[0].args, " "); got != c.want {
			t.Errorf("%s: forwarded %q, want %q", c.why, got, c.want)
		}
	}
}

func TestRunInputPropagatesAxeExitCode(t *testing.T) {
	// A passthrough that swallows AXe's exit code is not transparent: callers branch
	// on it exactly as they would running axe directly.
	calls := withFakeAxe(t, []axeResult{{"axe: element not found", &fakeExitError{code: 3}}})

	var out bytes.Buffer
	if code := runInput(&out, "tap", []string{"--udid", "SIM-1"}); code != 3 {
		t.Errorf("exit = %d, want AXe's own 3", code)
	}
	if len(*calls) != 1 {
		t.Errorf("expected no retry for a non-SimulatorKit failure, got %d calls", len(*calls))
	}
}

func TestRunInputTimeoutIsDistinctFromFailure(t *testing.T) {
	withFakeAxe(t, []axeResult{{"", &TimeoutError{Cmd: "axe tap", Timeout: time.Second}}})

	var out bytes.Buffer
	if code := runInput(&out, "tap", []string{"--udid", "SIM-1"}); code != 2 {
		t.Errorf("exit = %d, want 2 for a timeout (not AXe's exit code)", code)
	}
}

// fakeExitError stands in for exec.ExitError, whose ExitCode() cannot be constructed
// directly in a test without spawning a process.
type fakeExitError struct{ code int }

func (e *fakeExitError) Error() string { return "exit status " + string(rune('0'+e.code)) }
func (e *fakeExitError) ExitCode() int { return e.code }

func TestUnforwardedAxeVerbs(t *testing.T) {
	// Verbatim shape of `axe --help` captured 2026-08-15 (AXe 1.8.0), plus an
	// invented future verb to prove drift is actually detected.
	help := `SUBCOMMANDS:
  describe-ui             Describes the UI hierarchy of a booted simulator
  list-simulators         Lists all available simulators.
  init                    Install AXe skill files for detected AI clients.
  tap                     Tap a point on the screen
  type                    Type text by entering a sequence of characters.
  screenshot              Capture a screenshot from the simulator display
  pinch                   A verb a future AXe adds
  record-video            Record the display
`
	got := unforwardedAxeVerbs(help)
	if len(got) != 1 || got[0] != "pinch" {
		t.Errorf("unforwardedAxeVerbs = %v, want only the new verb [pinch]", got)
	}
}

func TestUnforwardedAxeVerbsIgnoresWhatXcuiOwns(t *testing.T) {
	// describe-ui / list-simulators / init are xcui's jobs, not gaps.
	help := `SUBCOMMANDS:
  describe-ui             Describes the UI hierarchy
  list-simulators         Lists simulators
  init                    Install skill files
`
	if got := unforwardedAxeVerbs(help); len(got) != 0 {
		t.Errorf("unforwardedAxeVerbs = %v, want empty", got)
	}
}

func TestTapStyleSupported(t *testing.T) {
	// xcui supplies --tap-style physical because AXe's default activates nothing.
	// If a future AXe drops or renames the flag, every tap starts failing on an
	// unknown flag, so doctor watches `axe tap --help` for it.
	help := `USAGE: axe tap [-x <x>] [-y <y>] [--id <id>] [--tap-style <tap-style>] --udid <udid>

OPTIONS:
  --tap-style <tap-style> Tap event style: automatic uses physical touch for
                          switches/toggles and simulator tap for other targets.
`
	if !tapStyleSupported(help) {
		t.Error("tapStyleSupported = false for help text that documents --tap-style")
	}
	if tapStyleSupported("USAGE: axe tap [-x <x>] [-y <y>] --udid <udid>\n") {
		t.Error("tapStyleSupported = true for help text without the flag")
	}
}

func TestRunInputRefusesAmbiguousSimulator(t *testing.T) {
	// The whole point of the change is an exit code, so pin it through the real
	// wiring: no --udid, several booted, nothing forwarded to AXe.
	withFakeExec(t, threeBootedTwoRuntimes)
	axeCalls := withFakeAxe(t, nil)

	var out bytes.Buffer
	if code := runInput(&out, "tap", []string{"--id", "cta"}); code != 2 {
		t.Errorf("exit = %d, want 2 (environment error)", code)
	}
	if len(*axeCalls) != 0 {
		t.Errorf("forwarded %d call(s) to AXe, want none — nothing may be driven", len(*axeCalls))
	}
}

func TestRunInputResolvesSingleSimulatorThenAddsTapStyle(t *testing.T) {
	// With one booted sim, xcui supplies both flags; this pins their order, which
	// no other case covers (every other test passes --udid explicitly).
	withFakeExec(t, sampleDevices)
	calls := withFakeAxe(t, []axeResult{{"", nil}})

	var out bytes.Buffer
	if code := runInput(&out, "tap", []string{"--id", "cta"}); code != 0 {
		t.Fatalf("exit = %d, want 0", code)
	}
	if len(*calls) != 1 {
		t.Fatalf("expected 1 AXe invocation, got %d", len(*calls))
	}
	if got := strings.Join((*calls)[0].args, " "); got != "tap --tap-style physical --udid BBBB --id cta" {
		t.Errorf("forwarded args = %q", got)
	}
}

func TestIsUnknownTapStyleError(t *testing.T) {
	// AXe below 1.7.0 has no --tap-style, so every xcui tap fails on the flag xcui
	// itself added. Recognize that exact stderr so the advice can name the cause.
	if !isUnknownTapStyleError("Error: Unknown option '--tap-style'\n") {
		t.Error("did not recognize AXe's unknown-option error for --tap-style")
	}
	if isUnknownTapStyleError("Error: Unknown option '--wait-timeout'\n") {
		t.Error("matched an unknown-option error for a different flag")
	}
	if isUnknownTapStyleError("axe: element not found\n") {
		t.Error("matched an ordinary AXe failure")
	}
}
