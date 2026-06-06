package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
)

// compareOpts holds the parsed `compare` flags.
type compareOpts struct {
	human            bool
	both             bool
	failOnRegression bool
	thresholdPct     float64
	dsym             string
}

// parseCompareArgs extracts the two <baseline> <current> positionals and the
// flags. Go's flag parser stops at the first positional, so we Parse the tail
// repeatedly, peeling one positional each pass — flags before, between, or
// after the two traces all work. Returns the traces, options, and an exit code
// (0 = ok, 2 = usage error).
func parseCompareArgs(args []string) (string, string, compareOpts, int) {
	fs := flag.NewFlagSet("compare", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	human := fs.Bool("human", false, "human-readable markdown (default: compact JSON)")
	both := fs.Bool("both", false, "emit markdown then compact JSON")
	failOn := fs.Bool("fail-on-regression", false, "exit 3 if any regression meets --threshold-pct")
	threshold := fs.Float64("threshold-pct", 5.0, "inclusive CPU-share increase (percentage points) counted as a regression")
	dsym := fs.String("dsym", "", "path to a .dSYM/Mach-O for symbolicating both traces (default: auto-discover by UUID)")

	var positionals []string
	rest := args
	for {
		if err := fs.Parse(rest); err != nil {
			return "", "", compareOpts{}, 2
		}
		rest = fs.Args()
		if len(rest) == 0 {
			break
		}
		positionals = append(positionals, rest[0])
		rest = rest[1:]
	}
	if len(positionals) > 2 {
		fmt.Fprintf(os.Stderr, "compare: unexpected extra argument %q (two traces only: <baseline> <current>)\n", positionals[2])
		return "", "", compareOpts{}, 2
	}
	if len(positionals) != 2 {
		fmt.Fprintln(os.Stderr, "compare: usage: xcprof compare <baseline> <current> [flags]")
		return "", "", compareOpts{}, 2
	}

	opts := compareOpts{
		human:            *human,
		both:             *both,
		failOnRegression: *failOn,
		thresholdPct:     *threshold,
		dsym:             *dsym,
	}
	return positionals[0], positionals[1], opts, 0
}

func runCompare(out io.Writer, args []string) int {
	baseline, current, opts, code := parseCompareArgs(args)
	if code != 0 {
		return code
	}
	for _, tr := range []string{baseline, current} {
		if _, err := os.Stat(tr); err != nil {
			fmt.Fprintln(os.Stderr, "compare:", err)
			return 2
		}
	}

	ctx := context.Background()
	// userHints/startMS/endMS are intentionally unset: compare diffs the hot-frame
	// tables (not the user-frame view --user-binary tunes) over the full trace.
	aOpts := analyzeOpts{dsym: opts.dsym, hang: 250}
	baseRep, err := analyzeTrace(ctx, baseline, aOpts)
	if err != nil {
		fmt.Fprintln(os.Stderr, "compare: baseline:", err)
		return 2
	}
	curRep, err := analyzeTrace(ctx, current, aOpts)
	if err != nil {
		fmt.Fprintln(os.Stderr, "compare: current:", err)
		return 2
	}

	rep := diffReports(baseRep, curRep, opts.thresholdPct)
	if wcode := writeCompare(out, rep, opts.human, opts.both); wcode != 0 {
		return wcode
	}
	return compareExitCode(rep, opts.failOnRegression)
}

// compareExitCode gates CI on regressions: 3 when a regression met the
// threshold AND --fail-on-regression was set, 0 otherwise (distinct from 2
// usage / 8 I/O so an agent can tell "slower" from "broke").
func compareExitCode(rep CompareReport, failOnRegression bool) int {
	if failOnRegression && rep.Regressed {
		return 3
	}
	return 0
}

// writeCompare emits compact JSON by default (the toolkit convention), markdown
// with --human, or both. Returns 8 on an output-write error (the diff
// succeeded; the failure is purely I/O).
func writeCompare(out io.Writer, rep CompareReport, human, both bool) int {
	emitJSON := func() bool {
		enc := json.NewEncoder(out) // compact: no SetIndent
		if err := enc.Encode(rep); err != nil {
			fmt.Fprintln(os.Stderr, "compare: write output:", err)
			return false
		}
		return true
	}
	switch {
	case both:
		fmt.Fprint(out, renderCompareMarkdown(rep))
		fmt.Fprintln(out)
		if !emitJSON() {
			return 8
		}
	case human:
		fmt.Fprint(out, renderCompareMarkdown(rep))
	default:
		if !emitJSON() {
			return 8
		}
	}
	return 0
}

// renderCompareMarkdown renders a CompareReport as terse, human-glanceable
// markdown: a verdict line, the two traces side by side, then regression and
// improvement tables sorted by severity.
func renderCompareMarkdown(rep CompareReport) string {
	var b strings.Builder
	fmt.Fprintf(&b, "# xcprof compare — %s → %s\n\n", rep.Baseline.Trace, rep.Current.Trace)

	verdict := "no regression"
	if rep.Regressed {
		verdict = fmt.Sprintf("%d regression(s)", len(rep.Regressions))
	}
	fmt.Fprintf(&b, "**Verdict:** %s (threshold %.1fpp inclusive CPU share)\n", verdict, rep.ThresholdPct)

	b.WriteString("\n## Traces\n")
	b.WriteString("| | baseline | current |\n|---|---|---|\n")
	fmt.Fprintf(&b, "| trace | %s | %s |\n", rep.Baseline.Trace, rep.Current.Trace)
	fmt.Fprintf(&b, "| duration | %.3fs | %.3fs |\n", rep.Baseline.DurationSec, rep.Current.DurationSec)
	fmt.Fprintf(&b, "| cpu samples | %d | %d |\n", rep.Baseline.CPUSamples, rep.Current.CPUSamples)
	fmt.Fprintf(&b, "| main-thread share | %.1f%% | %.1f%% |\n", rep.Baseline.MainThreadPct, rep.Current.MainThreadPct)

	writeDeltaTable := func(title string, rows []FrameDelta) {
		fmt.Fprintf(&b, "\n## %s\n", title)
		if len(rows) == 0 {
			b.WriteString("- none\n")
			return
		}
		b.WriteString("| function | binary | incl % (base→cur) | self Δpp | ~ms Δ | severity |\n|---|---|---|---|---|---|\n")
		for _, d := range rows {
			tag := ""
			if d.System {
				tag = " ⟨sys⟩"
			}
			kind := ""
			if d.Kind != "changed" {
				kind = " (" + d.Kind + ")"
			}
			fmt.Fprintf(&b, "| %s%s%s | %s | %.1f→%.1f (%+.1f) | %+.1f | %+.0f | %.0f |\n",
				d.Name, tag, kind, d.Binary, d.BaselineInclPct, d.CurrentInclPct, d.InclPctDelta, d.SelfPctDelta, d.InclMSDelta, d.Severity)
		}
	}
	writeDeltaTable("Regressions", rep.Regressions)
	writeDeltaTable("Improvements", rep.Improvements)

	if n := rep.Network; n != nil {
		b.WriteString("\n## Network\n")
		fmt.Fprintf(&b, "- rx: %s → %s (%+d B)\n", humanBytes(n.BaselineRxBytes), humanBytes(n.CurrentRxBytes), n.RxBytesDelta)
		fmt.Fprintf(&b, "- tx: %s → %s (%+d B)\n", humanBytes(n.BaselineTxBytes), humanBytes(n.CurrentTxBytes), n.TxBytesDelta)
	}

	if len(rep.Notes) > 0 {
		b.WriteString("\n## Notes\n")
		for _, note := range rep.Notes {
			fmt.Fprintf(&b, "- %s\n", note)
		}
	}
	return b.String()
}
