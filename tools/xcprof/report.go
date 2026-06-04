package main

import (
	"fmt"
	"strings"
)

// renderMarkdown renders an AnalyzeReport as a terse markdown report following
// the fixed section order. Markdown stays cheap for an LLM while remaining
// human-glanceable; frame cost is shown as % of CPU cycles plus an approximate
// wall-time in ms (see enrichWeights for why ms is sample-derived).
func renderMarkdown(r AnalyzeReport) string {
	var b strings.Builder
	s := r.Summary

	fmt.Fprintf(&b, "# xcprof analyze — %s\n\n", s.Trace)

	// 1. Summary
	b.WriteString("## Summary\n")
	if s.Target != "" {
		fmt.Fprintf(&b, "- target: %s (pid %d)\n", s.Target, s.TargetPID)
	}
	if s.Device != "" {
		fmt.Fprintf(&b, "- device: %s · %s %s\n", s.Device, s.Platform, s.OSVersion)
	}
	fmt.Fprintf(&b, "- duration: %.3fs · mode: %s · end: %s\n", s.DurationSec, s.RecordingMode, s.EndReason)
	fmt.Fprintf(&b, "- instruments: %s · time-limit: %s\n", s.InstrumentsVersion, s.TimeLimit)
	if r.Scope != nil {
		fmt.Fprintf(&b, "- scope: %d–%dms (%d samples in window)\n", r.Scope.StartMS, r.Scope.EndMS, r.Scope.SamplesInScope)
	}

	// 2. Support matrix
	b.WriteString("\n## Support\n")
	for _, f := range r.Support {
		if f.Note != "" {
			fmt.Fprintf(&b, "- %s: %s — %s\n", f.Family, f.Status, f.Note)
		} else {
			fmt.Fprintf(&b, "- %s: %s\n", f.Family, f.Status)
		}
	}

	// 3. CPU / Time Profiler
	fmt.Fprintf(&b, "\n## CPU (%d samples)\n", r.CPUSamples)
	if len(r.HotFrames) == 0 {
		b.WriteString("- no hot frames\n")
	} else {
		b.WriteString("| function | binary | inclusive | self | samples |\n|---|---|---|---|---|\n")
		for _, hf := range r.HotFrames {
			tag := ""
			if hf.System {
				tag = " ⟨sys⟩"
			}
			fmt.Fprintf(&b, "| %s%s | %s | %.1f%% (~%.0fms) | %.1f%% (~%.0fms) | %d |\n",
				hf.Name, tag, hf.Binary, hf.InclusivePct, hf.InclusiveMS, hf.SelfPct, hf.SelfMS, hf.Samples)
		}
	}

	// 4. Main-thread hangs (approximate)
	if r.MainThread != nil {
		mt := r.MainThread
		b.WriteString("\n## Main thread (approximate)\n")
		fmt.Fprintf(&b, "- samples: %d · cpu share: %.1f%% · max gap: %dms (threshold %dms) · candidate stalls: %d\n",
			mt.Samples, mt.WeightPct, mt.MaxGapMS, mt.GapThresholdMS, mt.CandidateStalls)
	}

	// 5. Top user-code frames
	b.WriteString("\n## Top user-code frames\n")
	if len(r.UserFrames) == 0 {
		b.WriteString("- none attributed (release build without --dsym, or no app frames in window)\n")
	} else {
		b.WriteString("| function | binary | self | inclusive |\n|---|---|---|---|\n")
		for _, hf := range r.UserFrames {
			fmt.Fprintf(&b, "| %s | %s | %.1f%% (~%.0fms) | %.1f%% (~%.0fms) |\n",
				hf.Name, hf.Binary, hf.SelfPct, hf.SelfMS, hf.InclusivePct, hf.InclusiveMS)
		}
	}

	// 6. (parse failures) / 7. (other families) collapse into Support above in Phase 1.
	// 8. Notes / caveats
	if len(r.Notes) > 0 {
		b.WriteString("\n## Notes\n")
		for _, n := range r.Notes {
			fmt.Fprintf(&b, "- %s\n", n)
		}
	}
	return b.String()
}
