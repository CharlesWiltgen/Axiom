package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

// hf builds a HotFrame with the cycle-share + approximate-ms fields compare
// reads. Raw cycle counts/samples are irrelevant to the diff (it works on the
// normalized %/ms the analyze pipeline already computed), so they stay zero.
func hf(binary, name string, inclPct, selfPct, inclMS, selfMS float64, system bool) HotFrame {
	return HotFrame{
		Binary: binary, Name: name, System: system,
		InclusivePct: inclPct, SelfPct: selfPct,
		InclusiveMS: inclMS, SelfMS: selfMS,
	}
}

// report wraps a set of hot frames in a minimal AnalyzeReport for diffing.
func report(trace string, frames ...HotFrame) AnalyzeReport {
	return AnalyzeReport{
		Summary:    Summary{Trace: trace, DurationSec: 10},
		CPUSamples: 100,
		HotFrames:  frames,
	}
}

const thresh = 5.0

// findDelta returns the delta for a (binary,name) in a list, or false.
func findDelta(list []FrameDelta, binary, name string) (FrameDelta, bool) {
	for _, d := range list {
		if d.Binary == binary && d.Name == name {
			return d, true
		}
	}
	return FrameDelta{}, false
}

func TestDiffReportsDetectsRegression(t *testing.T) {
	base := report("base.trace", hf("MyApp", "render()", 10, 8, 1000, 800, false))
	cur := report("cur.trace", hf("MyApp", "render()", 30, 25, 3000, 2500, false))
	rep := diffReports(base, cur, thresh)

	if !rep.Regressed {
		t.Fatal("expected regressed=true for a +20pp inclusive shift")
	}
	d, ok := findDelta(rep.Regressions, "MyApp", "render()")
	if !ok {
		t.Fatal("render() missing from regressions")
	}
	if d.InclPctDelta != 20 {
		t.Errorf("incl_pct_delta = %.2f, want 20", d.InclPctDelta)
	}
	if d.Kind != "changed" {
		t.Errorf("kind = %q, want changed", d.Kind)
	}
	if d.BaselineInclPct != 10 || d.CurrentInclPct != 30 {
		t.Errorf("baseline/current incl = %.1f/%.1f, want 10/30", d.BaselineInclPct, d.CurrentInclPct)
	}
	// severity = |20| × max(1000,3000)ms = 60000
	if d.Severity != 60000 {
		t.Errorf("severity = %.1f, want 60000 (|20| × 3000ms)", d.Severity)
	}
}

func TestDiffReportsDetectsImprovement(t *testing.T) {
	base := report("base.trace", hf("MyApp", "decode()", 30, 28, 3000, 2800, false))
	cur := report("cur.trace", hf("MyApp", "decode()", 10, 8, 1000, 800, false))
	rep := diffReports(base, cur, thresh)

	if rep.Regressed {
		t.Error("a pure improvement must not set regressed")
	}
	if len(rep.Regressions) != 0 {
		t.Errorf("expected no regressions, got %d", len(rep.Regressions))
	}
	d, ok := findDelta(rep.Improvements, "MyApp", "decode()")
	if !ok {
		t.Fatal("decode() missing from improvements")
	}
	if d.InclPctDelta != -20 {
		t.Errorf("incl_pct_delta = %.2f, want -20", d.InclPctDelta)
	}
}

func TestDiffReportsBelowThresholdIgnored(t *testing.T) {
	// A +3pp shift is below the 5pp threshold — neither a regression nor an
	// improvement; it falls in the noise band and is dropped from both lists.
	base := report("base.trace", hf("MyApp", "tick()", 10, 9, 1000, 900, false))
	cur := report("cur.trace", hf("MyApp", "tick()", 13, 12, 1300, 1200, false))
	rep := diffReports(base, cur, thresh)

	if rep.Regressed {
		t.Error("3pp < 5pp threshold must not regress")
	}
	if len(rep.Regressions) != 0 || len(rep.Improvements) != 0 {
		t.Errorf("sub-threshold change leaked into a list: reg=%d imp=%d", len(rep.Regressions), len(rep.Improvements))
	}
}

func TestDiffReportsNewAndGoneFrames(t *testing.T) {
	base := report("base.trace", hf("MyApp", "gone()", 12, 12, 1200, 1200, false))
	cur := report("cur.trace", hf("MyApp", "new()", 15, 15, 1500, 1500, false))
	rep := diffReports(base, cur, thresh)

	newD, ok := findDelta(rep.Regressions, "MyApp", "new()")
	if !ok {
		t.Fatal("new() (current only) should be a regression")
	}
	if newD.Kind != "new" || newD.BaselineInclPct != 0 || newD.CurrentInclPct != 15 {
		t.Errorf("new() delta = %+v, want kind=new baseline=0 current=15", newD)
	}
	goneD, ok := findDelta(rep.Improvements, "MyApp", "gone()")
	if !ok {
		t.Fatal("gone() (baseline only) should be an improvement")
	}
	if goneD.Kind != "gone" || goneD.CurrentInclPct != 0 || goneD.InclPctDelta != -12 {
		t.Errorf("gone() delta = %+v, want kind=gone current=0 delta=-12", goneD)
	}
}

func TestDiffReportsSeverityOrdering(t *testing.T) {
	// Two regressions, same +10pp delta but different absolute ms — the one
	// representing more wall-time must rank first (severity = pct × ms).
	base := report("base.trace",
		hf("MyApp", "small()", 5, 5, 50, 50, false),
		hf("MyApp", "big()", 5, 5, 5000, 5000, false),
	)
	cur := report("cur.trace",
		hf("MyApp", "small()", 15, 15, 150, 150, false),
		hf("MyApp", "big()", 15, 15, 15000, 15000, false),
	)
	rep := diffReports(base, cur, thresh)
	if len(rep.Regressions) != 2 {
		t.Fatalf("expected 2 regressions, got %d", len(rep.Regressions))
	}
	if rep.Regressions[0].Name != "big()" {
		t.Errorf("regressions[0] = %q, want big() (higher severity ranks first)", rep.Regressions[0].Name)
	}
}

func TestDiffReportsSkipsRawAddressFrames(t *testing.T) {
	// Raw-address frames (0x…) don't match across builds (ASLR), so matching them
	// is meaningless — they must be excluded from both lists and counted in a note.
	base := report("base.trace", hf("MyApp", "0x1024044f0", 10, 10, 1000, 1000, false))
	cur := report("cur.trace", hf("MyApp", "0x1099bc230", 40, 40, 4000, 4000, false))
	rep := diffReports(base, cur, thresh)

	if len(rep.Regressions) != 0 || len(rep.Improvements) != 0 {
		t.Errorf("raw-address frames must not produce deltas: reg=%d imp=%d", len(rep.Regressions), len(rep.Improvements))
	}
	if rep.Regressed {
		t.Error("raw-address-only diff must not regress")
	}
	joined := strings.Join(rep.Notes, " ")
	if !strings.Contains(joined, "unsymbolicated") {
		t.Errorf("expected a note about excluded unsymbolicated frames, got %v", rep.Notes)
	}
}

func TestDiffReportsTruncationDisclosed(t *testing.T) {
	// More regressions than the display cap: the list truncates to compareTopN
	// but regressed stays true AND a note discloses the full count, so a capped
	// list never reads as "that's all of them."
	var baseFrames, curFrames []HotFrame
	for i := 0; i < compareTopN+5; i++ {
		name := fmt.Sprintf("f%02d", i)
		baseFrames = append(baseFrames, hf("MyApp", name, 1, 1, 100, 100, false))
		curFrames = append(curFrames, hf("MyApp", name, 20, 20, 2000, 2000, false))
	}
	rep := diffReports(report("base.trace", baseFrames...), report("cur.trace", curFrames...), thresh)
	if len(rep.Regressions) != compareTopN {
		t.Errorf("regressions = %d, want %d (capped)", len(rep.Regressions), compareTopN)
	}
	if !rep.Regressed {
		t.Error("regressed must stay true even when the list is capped")
	}
	if want := fmt.Sprintf("%d regressions met the threshold", compareTopN+5); !strings.Contains(strings.Join(rep.Notes, " "), want) {
		t.Errorf("expected a note disclosing the full count %q, got %v", want, rep.Notes)
	}
}

func TestDiffReportsNetworkDelta(t *testing.T) {
	base := report("base.trace")
	base.Network = &NetworkReport{TotalRxBytes: 1000, TotalTxBytes: 200}
	cur := report("cur.trace")
	cur.Network = &NetworkReport{TotalRxBytes: 5000, TotalTxBytes: 200}
	rep := diffReports(base, cur, thresh)

	if rep.Network == nil {
		t.Fatal("expected a network delta")
	}
	if rep.Network.RxBytesDelta != 4000 {
		t.Errorf("rx delta = %d, want 4000", rep.Network.RxBytesDelta)
	}
	if rep.Network.TxBytesDelta != 0 {
		t.Errorf("tx delta = %d, want 0", rep.Network.TxBytesDelta)
	}
}

func TestDiffReportsCarriesSides(t *testing.T) {
	base := report("base.trace", hf("MyApp", "f()", 10, 10, 100, 100, false))
	cur := report("cur.trace", hf("MyApp", "f()", 10, 10, 100, 100, false))
	rep := diffReports(base, cur, thresh)
	if rep.Baseline.Trace != "base.trace" || rep.Current.Trace != "cur.trace" {
		t.Errorf("sides = %q/%q, want base.trace/cur.trace", rep.Baseline.Trace, rep.Current.Trace)
	}
	if rep.ThresholdPct != thresh {
		t.Errorf("threshold = %.1f, want %.1f", rep.ThresholdPct, thresh)
	}
}

func TestDiffReportsSystemFrameMarked(t *testing.T) {
	base := report("base.trace", hf("UIKitCore", "layout", 10, 10, 1000, 1000, true))
	cur := report("cur.trace", hf("UIKitCore", "layout", 25, 25, 2500, 2500, true))
	rep := diffReports(base, cur, thresh)
	d, ok := findDelta(rep.Regressions, "UIKitCore", "layout")
	if !ok {
		t.Fatal("system-frame regression should still be reported")
	}
	if !d.System {
		t.Error("system flag must be carried through to the delta")
	}
}

// --- arg parsing ---

func TestParseCompareArgsTwoTraces(t *testing.T) {
	base, cur, opts, code := parseCompareArgs([]string{"a.trace", "b.trace"})
	if code != 0 || base != "a.trace" || cur != "b.trace" {
		t.Fatalf("got base=%q cur=%q code=%d", base, cur, code)
	}
	if opts.thresholdPct != 5.0 {
		t.Errorf("default threshold = %.1f, want 5.0", opts.thresholdPct)
	}
}

func TestParseCompareArgsFlagsAfterTraces(t *testing.T) {
	base, cur, opts, code := parseCompareArgs([]string{"a.trace", "b.trace", "--fail-on-regression", "--threshold-pct", "3"})
	if code != 0 || base != "a.trace" || cur != "b.trace" {
		t.Fatalf("got base=%q cur=%q code=%d", base, cur, code)
	}
	if !opts.failOnRegression {
		t.Error("--fail-on-regression not parsed")
	}
	if opts.thresholdPct != 3 {
		t.Errorf("threshold = %.1f, want 3", opts.thresholdPct)
	}
}

func TestParseCompareArgsFlagsBeforeTraces(t *testing.T) {
	base, cur, opts, code := parseCompareArgs([]string{"--human", "a.trace", "b.trace"})
	if code != 0 || base != "a.trace" || cur != "b.trace" || !opts.human {
		t.Fatalf("got base=%q cur=%q human=%v code=%d", base, cur, opts.human, code)
	}
}

func TestParseCompareArgsMissingTrace(t *testing.T) {
	if _, _, _, code := parseCompareArgs([]string{"a.trace"}); code != 2 {
		t.Errorf("one trace should be a usage error (2), got %d", code)
	}
	if _, _, _, code := parseCompareArgs([]string{}); code != 2 {
		t.Errorf("no traces should be a usage error (2), got %d", code)
	}
}

func TestParseCompareArgsTooManyTraces(t *testing.T) {
	if _, _, _, code := parseCompareArgs([]string{"a.trace", "b.trace", "c.trace"}); code != 2 {
		t.Errorf("three traces should be a usage error (2), got %d", code)
	}
}

// --- exit-code / rendering glue ---

func TestCompareExitCodeRegressionGate(t *testing.T) {
	reg := CompareReport{Regressed: true}
	clean := CompareReport{Regressed: false}
	if got := compareExitCode(reg, true); got != 3 {
		t.Errorf("regressed + --fail-on-regression → %d, want 3", got)
	}
	if got := compareExitCode(reg, false); got != 0 {
		t.Errorf("regressed without the flag → %d, want 0", got)
	}
	if got := compareExitCode(clean, true); got != 0 {
		t.Errorf("clean + --fail-on-regression → %d, want 0", got)
	}
}

func TestWriteCompareBothEmitsMarkdownThenJSON(t *testing.T) {
	base := report("base.trace", hf("MyApp", "render()", 10, 8, 1000, 800, false))
	cur := report("cur.trace", hf("MyApp", "render()", 30, 25, 3000, 2500, false))
	rep := diffReports(base, cur, thresh)

	var buf bytes.Buffer
	if code := writeCompare(&buf, rep, false, true); code != 0 {
		t.Fatalf("writeCompare(both) returned %d, want 0", code)
	}
	out := buf.String()
	mdIdx := strings.Index(out, "# xcprof compare")
	jsonIdx := strings.Index(out, `{"tool":"xcprof"`)
	if mdIdx < 0 || jsonIdx < 0 {
		t.Fatalf("expected both markdown and JSON, got:\n%s", out)
	}
	if mdIdx > jsonIdx {
		t.Error("--both must emit markdown before JSON")
	}
	// The final line must be a self-contained, parseable JSON object.
	trimmed := strings.TrimSpace(out)
	jsonLine := trimmed[strings.LastIndex(trimmed, "\n")+1:]
	var decoded CompareReport
	if err := json.Unmarshal([]byte(jsonLine), &decoded); err != nil {
		t.Fatalf("final line is not valid JSON: %v\nline=%s", err, jsonLine)
	}
	if !decoded.Regressed {
		t.Error("decoded JSON should carry regressed=true")
	}
}

func TestRenderCompareMarkdownSections(t *testing.T) {
	base := report("base.trace", hf("MyApp", "render()", 10, 8, 1000, 800, false))
	cur := report("cur.trace", hf("MyApp", "render()", 30, 25, 3000, 2500, false))
	md := renderCompareMarkdown(diffReports(base, cur, thresh))
	for _, want := range []string{"# xcprof compare", "## Regressions", "render()"} {
		if !strings.Contains(md, want) {
			t.Errorf("markdown missing %q", want)
		}
	}
}
