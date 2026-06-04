package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// cpuProfileXPath targets run 1 — the same run parseTOC selects. If multi-run
// selection is ever added, both must change together.
const cpuProfileXPath = `/trace-toc/run[@number="1"]/data/table[@schema="cpu-profile"]`

// exportTOC and exportTable are indirected so tests can drive analysis from
// fixtures without a real .trace.
var exportTOC = func(ctx context.Context, trace string) ([]byte, error) {
	res, err := ExecRun(ctx, 0, "xcrun", "xctrace", "export", "--input", trace, "--toc")
	if err != nil {
		return nil, err
	}
	return res.Stdout, nil
}

var exportTable = func(ctx context.Context, trace, xpath string) ([]byte, error) {
	res, err := ExecRun(ctx, 0, "xcrun", "xctrace", "export", "--input", trace, "--xpath", xpath)
	if err != nil {
		return nil, err
	}
	return res.Stdout, nil
}

// buildReport is the pure orchestration: TOC + cpu-profile bytes -> report.
// Kept separate from runAnalyze so it is unit-testable against fixtures.
func buildReport(trace string, tocBytes, cpuBytes []byte, startMS, endMS int64, userHints []string, hangThresholdMS int64) (AnalyzeReport, error) {
	toc, err := parseTOC(tocBytes)
	if err != nil {
		return AnalyzeReport{}, err
	}
	rep := AnalyzeReport{
		Tool:    "xcprof",
		Version: version,
		Summary: Summary{
			Trace:              filepath.Base(trace),
			Target:             toc.Target.Name,
			TargetPID:          toc.Target.PID,
			Device:             toc.Device.Name,
			Platform:           toc.Device.Platform,
			OSVersion:          toc.Device.OSVersion,
			RecordingMode:      toc.RecordingMode,
			DurationSec:        toc.DurationSec,
			EndReason:          toc.EndReason,
			InstrumentsVersion: toc.InstrumentsVersion,
			TimeLimit:          toc.TimeLimit,
			Template:           toc.TemplateName,
		},
	}

	var samples []Sample
	if toc.hasSchema("cpu-profile") && len(cpuBytes) > 0 {
		samples, err = parseCPUProfile(cpuBytes)
		if err != nil {
			return AnalyzeReport{}, err
		}
	}
	// The support matrix is a trace-level inventory: base it on the full parsed
	// count, not the scoped window, so `--start-ms`/`--end-ms` that excludes all
	// samples doesn't misreport cpu as "partial — no samples parsed".
	fullSampleCount := len(samples)
	if startMS > 0 || endMS > 0 {
		scoped := scopeByTime(samples, startMS, endMS)
		rep.Scope = &ScopeInfo{StartMS: startMS, EndMS: endMS, SamplesInScope: len(scoped)}
		samples = scoped
	}
	rep.CPUSamples = len(samples)
	rep.Support = supportMatrix(toc, fullSampleCount)

	if len(samples) > 0 {
		userBinaries := userBinarySet(toc.Target.Name, userHints)
		rep.HotFrames = aggregateHotFrames(samples, 15)
		rep.UserFrames = topUserFrames(samples, userBinaries, 15)
		mt := mainThreadStats(samples, hangThresholdMS)

		totalCycles := totalCycleWeight(samples)
		windowSec := analyzedWindowSec(rep.Summary.DurationSec, startMS, endMS, rep.Scope != nil)
		enrichWeights(rep.HotFrames, totalCycles, len(samples), windowSec)
		enrichWeights(rep.UserFrames, totalCycles, len(samples), windowSec)
		if totalCycles > 0 {
			mt.WeightPct = round2(100 * float64(mt.Weight) / float64(totalCycles))
		}
		rep.MainThread = &mt
	}

	rep.Notes = append(rep.Notes,
		"main-thread stall figures are approximate (cpu-profile samples running threads only; the Hangs instrument confirms)",
	)
	if len(rep.HotFrames) > 0 {
		rep.Notes = append(rep.Notes,
			"frame % is share of CPU cycles; ms is approximate (sample-share × window), since cycle-weight is cycles, not time",
		)
	}
	if symbolNeeded(rep.UserFrames) {
		rep.Notes = append(rep.Notes, "some frames are raw addresses (stripped binary); pass --dsym for symbol names (xcprof Phase 2)")
	}
	return rep, nil
}

func symbolNeeded(frames []HotFrame) bool {
	for _, f := range frames {
		if strings.HasPrefix(f.Name, "0x") {
			return true
		}
	}
	return false
}

type analyzeOpts struct {
	asJSON    bool
	both      bool
	open      bool
	startMS   int64
	endMS     int64
	hang      int64
	userHints []string
}

// parseAnalyzeArgs extracts the single <trace> positional and the flags. Go's
// flag parser stops at the first positional, so a natural `analyze <trace>
// --json` would drop the flag; we parse, take the trace, then parse the
// remaining flags. Flags before or after the trace both work. Returns the
// trace, options, and an exit code (0 = ok, 2 = usage error).
func parseAnalyzeArgs(args []string) (string, analyzeOpts, int) {
	fs := flag.NewFlagSet("analyze", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	asJSON := fs.Bool("json", false, "emit compact JSON instead of markdown")
	both := fs.Bool("both", false, "emit markdown then compact JSON")
	startMS := fs.Int64("start-ms", 0, "scope analysis to samples at or after this offset (ms)")
	endMS := fs.Int64("end-ms", 0, "scope analysis to samples at or before this offset (ms)")
	hang := fs.Int64("hang-threshold-ms", 250, "main-thread gap (ms) counted as a candidate stall")
	userBinary := fs.String("user-binary", "", "comma-separated binary names to attribute as user code (when set, only the target binary + these count; default: all non-system frames)")
	open := fs.Bool("open", false, "after analysis, open the trace in Instruments.app")

	if err := fs.Parse(args); err != nil {
		return "", analyzeOpts{}, 2
	}
	rest := fs.Args()
	if len(rest) == 0 {
		fmt.Fprintln(os.Stderr, "analyze: usage: xcprof analyze <trace> [flags]")
		return "", analyzeOpts{}, 2
	}
	trace := rest[0]
	if len(rest) > 1 {
		if err := fs.Parse(rest[1:]); err != nil {
			return "", analyzeOpts{}, 2
		}
		if fs.NArg() > 0 {
			fmt.Fprintf(os.Stderr, "analyze: unexpected extra argument %q (one trace only)\n", fs.Arg(0))
			return "", analyzeOpts{}, 2
		}
	}
	opts := analyzeOpts{asJSON: *asJSON, both: *both, open: *open, startMS: *startMS, endMS: *endMS, hang: *hang}
	for _, h := range strings.Split(*userBinary, ",") {
		if h = strings.TrimSpace(h); h != "" {
			opts.userHints = append(opts.userHints, h)
		}
	}
	return trace, opts, 0
}

func runAnalyze(out io.Writer, args []string) int {
	trace, opts, code := parseAnalyzeArgs(args)
	if code != 0 {
		return code
	}
	if _, err := os.Stat(trace); err != nil {
		fmt.Fprintln(os.Stderr, "analyze:", err)
		return 2
	}

	ctx := context.Background()
	tocBytes, err := exportTOC(ctx, trace)
	if err != nil {
		fmt.Fprintln(os.Stderr, "analyze: export toc:", err)
		return 2
	}
	toc, err := parseTOC(tocBytes)
	if err != nil {
		fmt.Fprintln(os.Stderr, "analyze:", err)
		return 2
	}
	var cpuBytes []byte
	if toc.hasSchema("cpu-profile") {
		cpuBytes, err = exportTable(ctx, trace, cpuProfileXPath)
		if err != nil {
			fmt.Fprintln(os.Stderr, "analyze: export cpu-profile:", err)
			return 2
		}
	}

	rep, err := buildReport(trace, tocBytes, cpuBytes, opts.startMS, opts.endMS, opts.userHints, opts.hang)
	if err != nil {
		fmt.Fprintln(os.Stderr, "analyze:", err)
		return 2
	}

	code = writeAnalyze(out, rep, opts.asJSON, opts.both)
	if opts.open {
		_, _ = ExecRun(ctx, 0, "open", trace)
	}
	return code
}

// writeAnalyze emits compact JSON (LLM-lean) and/or terse markdown. Returns
// the exit code (0 ok, 8 on output-write error — matching the rest of the
// toolkit; analysis succeeded, so the failure is purely I/O).
func writeAnalyze(out io.Writer, rep AnalyzeReport, asJSON, both bool) int {
	emitJSON := func() bool {
		enc := json.NewEncoder(out) // compact: no SetIndent
		if err := enc.Encode(rep); err != nil {
			fmt.Fprintln(os.Stderr, "analyze: write output:", err)
			return false
		}
		return true
	}
	switch {
	case both:
		fmt.Fprint(out, renderMarkdown(rep))
		fmt.Fprintln(out)
		if !emitJSON() {
			return 8
		}
	case asJSON:
		if !emitJSON() {
			return 8
		}
	default:
		fmt.Fprint(out, renderMarkdown(rep))
	}
	return 0
}
