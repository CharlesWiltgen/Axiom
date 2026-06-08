package main

import (
	"bytes"
	"testing"
)

func TestRenderA11yHumanSetRelaunched(t *testing.T) {
	var buf bytes.Buffer
	renderA11yHuman(&buf, A11yReport{Tool: "xcui", Version: "x", Toggle: "reduce-motion", Value: "on", Applied: true, Relaunched: true})
	want := "a11y set: reduce-motion = on (applied, relaunched)\n"
	if got := buf.String(); got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestRenderA11yHumanSetWithNote(t *testing.T) {
	var buf bytes.Buffer
	renderA11yHuman(&buf, A11yReport{Toggle: "reduce-motion", Value: "on", Applied: true, Note: "setting written but no --app given; relaunch the app for it to take effect"})
	want := "a11y set: reduce-motion = on (applied)\n" +
		"  note: setting written but no --app given; relaunch the app for it to take effect\n"
	if got := buf.String(); got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestRenderA11yHumanReset(t *testing.T) {
	var buf bytes.Buffer
	renderA11yHuman(&buf, A11yReport{Applied: true, Note: "accessibility overrides cleared"})
	want := "a11y reset: applied\n  note: accessibility overrides cleared\n"
	if got := buf.String(); got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestRenderVoiceOverHumanTraverse(t *testing.T) {
	var buf bytes.Buffer
	renderVoiceOverHuman(&buf, VoiceOverReport{Action: "traverse", Count: 2, Sequence: []string{"Artwork, image", "Play all, button"}})
	want := "voiceover traverse: 2 announcements\n  [0] Artwork, image\n  [1] Play all, button\n"
	if got := buf.String(); got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestRenderVoiceOverHumanAssertPass(t *testing.T) {
	var buf bytes.Buffer
	renderVoiceOverHuman(&buf, VoiceOverReport{Action: "assert", Count: 2, Sequence: []string{"a", "b"}, Pass: true})
	want := "voiceover assert: pass=true (2 announcements)\n  [0] a\n  [1] b\n"
	if got := buf.String(); got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestRenderVoiceOverHumanAssertFailures(t *testing.T) {
	var buf bytes.Buffer
	renderVoiceOverHuman(&buf, VoiceOverReport{
		Action: "assert", Count: 1, Sequence: []string{"a"}, Pass: false,
		Failures: []string{`[0] got "a", want "b"`, "length: got 1 announcements, want 2"},
	})
	want := "voiceover assert: pass=false (1 announcements)\n" +
		"  [0] a\n" +
		"  failures:\n" +
		"    - [0] got \"a\", want \"b\"\n" +
		"    - length: got 1 announcements, want 2\n"
	if got := buf.String(); got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}
