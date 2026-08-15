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

func TestRunInputForwardsThroughRunAxe(t *testing.T) {
	// The whole point of the passthrough: input goes through runAxe, so it inherits
	// the SimulatorKit fallback. Assert the call actually lands there, with the verb
	// first and the caller's args untouched after it.
	calls := withFakeAxe(t, []axeResult{{"", nil}})

	var out bytes.Buffer
	code := runInput(&out, "tap", []string{"--udid", "SIM-1", "--id", "primary-cta"})
	if code != 0 {
		t.Fatalf("exit = %d, want 0", code)
	}
	if len(*calls) != 1 {
		t.Fatalf("expected 1 AXe invocation, got %d", len(*calls))
	}
	got := strings.Join((*calls)[0].args, " ")
	if got != "tap --udid SIM-1 --id primary-cta" {
		t.Errorf("forwarded args = %q, want the verb followed by argv verbatim", got)
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
