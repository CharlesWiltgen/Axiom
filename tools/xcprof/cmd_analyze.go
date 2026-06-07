package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// xctraceMissingTemplate is xctrace's verbatim phrase (Xcode 26) when
// `export --toc` runs against a .trace that has no exportable tables: an
// interrupted/unfinalized recording, or a memory- or energy-only capture whose
// data lives only in the Instruments event store. Matching the substring lets
// both analyze and record replace the opaque "xcrun: exit status 10: Export
// failed: Document Missing Template Error" with an actionable message.
const xctraceMissingTemplate = "Document Missing Template Error"

// noExportableTablesMsg is the actionable replacement analyze returns for that
// opaque error. It names the cause and the only way to inspect such a trace.
const noExportableTablesMsg = "this trace has no xctrace-exportable tables — it is likely an interrupted/unfinalized recording, or a memory- or energy-only capture whose data lives only in the Instruments event store; open it in Instruments.app (`xcprof analyze --open`) to inspect it"

// isMissingExportableTables reports whether err is xctrace's
// missing-exportable-tables failure (see xctraceMissingTemplate).
func isMissingExportableTables(err error) bool {
	return err != nil && strings.Contains(err.Error(), xctraceMissingTemplate)
}

// cpuProfileXPath / netStatXPath target run 1 — the same run parseTOC selects.
// If multi-run selection is ever added, all must change together.
const cpuProfileXPath = `/trace-toc/run[@number="1"]/data/table[@schema="cpu-profile"]`
const netStatXPath = `/trace-toc/run[@number="1"]/data/table[@schema="network-connection-stat"]`

// cpuProfileSchema / netStatSchema are the exportable tables xcprof parses.
// netStatSchema is the socket-statistics table (the "Network Connections"
// instrument). Verified on Xcode 26 — NOT http-traffic, which the Phase 1
// family table guessed.
const cpuProfileSchema = "cpu-profile"
const netStatSchema = "network-connection-stat"

// exportSpecs lists each schema xcprof can parse and the run-1 xpath that
// exports it. analyzeTrace exports every spec the TOC declares into
// buildOpts.families, keyed by schema — a table-driven replacement for the
// per-family if-chain, so a new exportable family is one entry here plus one
// dispatch block in buildReport.
var exportSpecs = []struct {
	schema string
	xpath  string
}{
	{cpuProfileSchema, cpuProfileXPath},
	{netStatSchema, netStatXPath},
}

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

// buildOpts bundles the inputs to buildReport. Grouping them behind named
// fields removes the silent-transposition risk of the old positional signature
// (startMS, endMS, and hangMS are all int64 — a swapped pair compiled cleanly)
// and gives Phase 2 family parsing (axiom-o4sg) a place to add
// memory/network/energy byte payloads without growing the argument list.
type buildOpts struct {
	trace     string
	toc       *TOC              // already parsed by the caller (analyzeTrace) — buildReport never re-parses
	families  map[string][]byte // exported table bytes keyed by schema (cpu-profile, network-connection-stat, …)
	startMS   int64
	endMS     int64
	hangMS    int64
	userHints []string
	symbolize func([]Sample) symbolizeResult
}

// buildReport is the pure orchestration: parsed TOC + table bytes -> report.
// Kept separate from runAnalyze so it is unit-testable against fixtures. It
// takes the already-parsed TOC (not raw bytes) so the parse + support-matrix
// decision stay derived from one source, and the TOC is parsed once per trace.
func buildReport(opts buildOpts) (AnalyzeReport, error) {
	toc := opts.toc
	rep := AnalyzeReport{
		Tool:    "xcprof",
		Version: version,
		Summary: Summary{
			Trace:              filepath.Base(opts.trace),
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

	// Parse dispatch is keyed on present families: the caller exported a table
	// only when the TOC declared its schema, so non-empty bytes ARE the presence
	// signal. (The support matrix still reads toc.hasSchema independently, so a
	// present-but-empty table reports `partial`, not silence.)
	var samples []Sample
	if b := opts.families[cpuProfileSchema]; len(b) > 0 {
		parsed, err := parseCPUProfile(b)
		if err != nil {
			return AnalyzeReport{}, err
		}
		samples = parsed
	}

	// Network is independent of the cpu/scope path: it aggregates its own table.
	var netConns int
	if b := opts.families[netStatSchema]; len(b) > 0 {
		net, nerr := parseNetworkStat(b, 15)
		if nerr != nil {
			return AnalyzeReport{}, nerr
		}
		netConns = net.Connections
		if net.Connections > 0 {
			rep.Network = &net
		}
	}
	// The support matrix is a trace-level inventory: base it on the full parsed
	// count, not the scoped window, so `--start-ms`/`--end-ms` that excludes all
	// samples doesn't misreport cpu as "partial — no samples parsed".
	fullSampleCount := len(samples)
	if opts.startMS > 0 || opts.endMS > 0 {
		scoped := scopeByTime(samples, opts.startMS, opts.endMS)
		rep.Scope = &ScopeInfo{StartMS: opts.startMS, EndMS: opts.endMS, SamplesInScope: len(scoped)}
		samples = scoped
	}
	rep.CPUSamples = len(samples)
	rep.Support = supportMatrix(toc, fullSampleCount, netConns)

	// Resolve raw-address frames before aggregation so hot/user frames carry
	// names. No-op (no shell-out) when nothing needs symbolicating.
	var symRes symbolizeResult
	if opts.symbolize != nil && len(samples) > 0 {
		symRes = opts.symbolize(samples)
	}

	if len(samples) > 0 {
		userBinaries := userBinarySet(toc.Target.Name, opts.userHints)
		rep.HotFrames = aggregateHotFrames(samples, 15)
		rep.UserFrames = topUserFrames(samples, userBinaries, 15)
		mt := mainThreadStats(samples, opts.hangMS)

		totalCycles := totalCycleWeight(samples)
		windowSec := analyzedWindowSec(rep.Summary.DurationSec, opts.startMS, opts.endMS, rep.Scope != nil)
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
	switch {
	case symRes.Attempted && symRes.Unresolved > 0 && symRes.Explicit:
		rep.Notes = append(rep.Notes, fmt.Sprintf(
			"%d address frame(s) unresolved by the supplied --dsym (resolved %d); it may not cover every image or the UUID may not match",
			symRes.Unresolved, symRes.Resolved))
	case symRes.Attempted && symRes.Unresolved > 0:
		rep.Notes = append(rep.Notes, fmt.Sprintf(
			"%d address frame(s) unresolved (no matching dSYM found); pass --dsym <path> to symbolicate (resolved %d)",
			symRes.Unresolved, symRes.Resolved))
	case !symRes.Attempted && symbolNeeded(rep.HotFrames):
		rep.Notes = append(rep.Notes, "some frames are raw addresses (stripped binary); pass --dsym for symbol names")
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
	dsym      string
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
	dsym := fs.String("dsym", "", "path to a .dSYM bundle or Mach-O for symbolicating raw-address frames (default: auto-discover by UUID via Spotlight)")
	open := fs.Bool("open", false, "after analysis, open the trace in Instruments.app")

	positionals, err := parseInterspersed(fs, args)
	if err != nil {
		return "", analyzeOpts{}, 2
	}
	if len(positionals) == 0 {
		fmt.Fprintln(os.Stderr, "analyze: usage: xcprof analyze <trace> [flags]")
		return "", analyzeOpts{}, 2
	}
	if len(positionals) > 1 {
		fmt.Fprintf(os.Stderr, "analyze: unexpected extra argument %q (one trace only)\n", positionals[1])
		return "", analyzeOpts{}, 2
	}
	trace := positionals[0]
	opts := analyzeOpts{asJSON: *asJSON, both: *both, open: *open, startMS: *startMS, endMS: *endMS, hang: *hang, dsym: *dsym}
	for _, h := range strings.Split(*userBinary, ",") {
		if h = strings.TrimSpace(h); h != "" {
			opts.userHints = append(opts.userHints, h)
		}
	}
	return trace, opts, 0
}

// analyzeTrace turns a single .trace path into an AnalyzeReport: export the
// TOC, export every parseable table the TOC declares (into a schema-keyed
// families map), then buildReport. Extracted from runAnalyze so `compare` can
// produce a report for each of its two traces without duplicating the
// export+symbolize sequence — and so the per-trace symbolize closure (which
// captures this trace's ctx + dsym) is built here, generalizing cleanly to the
// two-trace case.
func analyzeTrace(ctx context.Context, trace string, opts analyzeOpts) (AnalyzeReport, error) {
	tocBytes, err := exportTOC(ctx, trace)
	if err != nil {
		if isMissingExportableTables(err) {
			return AnalyzeReport{}, errors.New(noExportableTablesMsg)
		}
		return AnalyzeReport{}, fmt.Errorf("export toc: %w", err)
	}
	toc, err := parseTOC(tocBytes)
	if err != nil {
		return AnalyzeReport{}, err
	}
	families := map[string][]byte{}
	for _, spec := range exportSpecs {
		if !toc.hasSchema(spec.schema) {
			continue
		}
		b, terr := exportTable(ctx, trace, spec.xpath)
		if terr != nil {
			return AnalyzeReport{}, fmt.Errorf("export %s: %w", spec.schema, terr)
		}
		families[spec.schema] = b
	}
	symbolize := func(samples []Sample) symbolizeResult {
		return symbolizeSamples(ctx, samples, opts.dsym)
	}
	return buildReport(buildOpts{
		trace:     trace,
		toc:       toc,
		families:  families,
		startMS:   opts.startMS,
		endMS:     opts.endMS,
		hangMS:    opts.hang,
		userHints: opts.userHints,
		symbolize: symbolize,
	})
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
	rep, err := analyzeTrace(ctx, trace, opts)
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
