package main

import (
	"fmt"
	"io"
)

// This file holds the --human prose renderers for xcui's a11y and voiceover
// subcommands. Default output is compact JSON (token-lean for the LLM that
// usually drives xcui); --human opts into a terse, readable rendering for a
// person at a terminal. Mirrors tools/xcsym/human.go's render*(io.Writer, …)
// factoring so the prose is unit-testable without spawning a process.

// renderA11yHuman renders an A11yReport for `a11y set` (Toggle set) or
// `a11y reset` (Toggle empty). The trailing note, when present, is indented.
func renderA11yHuman(w io.Writer, rep A11yReport) {
	if rep.Toggle != "" {
		fmt.Fprintf(w, "a11y set: %s = %s (%s)\n", rep.Toggle, rep.Value, a11yStatus(rep))
	} else {
		fmt.Fprintf(w, "a11y reset: %s\n", a11yStatus(rep))
	}
	if rep.Note != "" {
		fmt.Fprintf(w, "  note: %s\n", rep.Note)
	}
}

// a11yStatus collapses the Applied/Relaunched flags into a short status phrase.
func a11yStatus(rep A11yReport) string {
	if !rep.Applied {
		return "not applied"
	}
	if rep.Relaunched {
		return "applied, relaunched"
	}
	return "applied"
}

// renderVoiceOverHuman renders a VoiceOverReport for `voiceover traverse` or
// `voiceover assert`: a header line, the numbered announcement sequence, then
// any assert failures.
func renderVoiceOverHuman(w io.Writer, rep VoiceOverReport) {
	if rep.Action == "assert" {
		fmt.Fprintf(w, "voiceover assert: pass=%v (%d announcements)\n", rep.Pass, rep.Count)
	} else {
		fmt.Fprintf(w, "voiceover traverse: %d announcements\n", rep.Count)
	}
	for i, s := range rep.Sequence {
		fmt.Fprintf(w, "  [%d] %s\n", i, s)
	}
	if len(rep.Failures) > 0 {
		fmt.Fprintln(w, "  failures:")
		for _, f := range rep.Failures {
			fmt.Fprintf(w, "    - %s\n", f)
		}
	}
}
