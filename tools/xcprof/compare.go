package main

import (
	"fmt"
	"math"
	"sort"
	"strings"
)

// compareTopN caps each delta list so a noisy diff stays glanceable; severity
// sorting guarantees the worst shifts survive the cut.
const compareTopN = 15

// FrameDelta is one function's change between two traces, matched by (binary,
// name). Percentages are percentage-POINTS of CPU-cycle share — the comparable
// quantity across traces of different total work (raw cycle-weights and ms are
// not directly comparable between runs). The *MS deltas are the approximate
// sample-share wall-time shift, informational only.
type FrameDelta struct {
	Name            string  `json:"name"`
	Binary          string  `json:"binary,omitempty"`
	System          bool    `json:"system,omitempty"`
	BaselineInclPct float64 `json:"baseline_incl_pct"`
	CurrentInclPct  float64 `json:"current_incl_pct"`
	InclPctDelta    float64 `json:"incl_pct_delta"`
	SelfPctDelta    float64 `json:"self_pct_delta"`
	InclMSDelta     float64 `json:"incl_ms_delta"`
	SelfMSDelta     float64 `json:"self_ms_delta"`
	Severity        float64 `json:"severity"` // |incl_pct_delta| × max(baseline,current inclusive ms)
	Kind            string  `json:"kind"`     // "new" (current only), "gone" (baseline only), "changed"
}

// CompareSide is the per-trace context shown alongside the deltas.
type CompareSide struct {
	Trace         string  `json:"trace"`
	DurationSec   float64 `json:"duration_s,omitempty"`
	CPUSamples    int     `json:"cpu_samples"`
	MainThreadPct float64 `json:"main_thread_pct,omitempty"`
}

// NetworkDelta is the trace-level network byte shift. Per-connection matching
// across runs is unreliable (ephemeral ports + per-run serials), so only the
// totals are diffed.
type NetworkDelta struct {
	BaselineRxBytes int64 `json:"baseline_rx_bytes"`
	CurrentRxBytes  int64 `json:"current_rx_bytes"`
	RxBytesDelta    int64 `json:"rx_bytes_delta"`
	BaselineTxBytes int64 `json:"baseline_tx_bytes"`
	CurrentTxBytes  int64 `json:"current_tx_bytes"`
	TxBytesDelta    int64 `json:"tx_bytes_delta"`
}

// CompareReport is the structured output of `xcprof compare`.
type CompareReport struct {
	Tool         string        `json:"tool"`
	Version      string        `json:"version"`
	ThresholdPct float64       `json:"threshold_pct"`
	Baseline     CompareSide   `json:"baseline"`
	Current      CompareSide   `json:"current"`
	Regressions  []FrameDelta  `json:"regressions,omitempty"`
	Improvements []FrameDelta  `json:"improvements,omitempty"`
	Network      *NetworkDelta `json:"network,omitempty"`
	Regressed    bool          `json:"regressed"`
	Notes        []string      `json:"notes,omitempty"`
}

// diffReports diffs two analyze reports into a regression/improvement view.
// Frames are matched by (binary, name) across each trace's top frames; a frame
// present in only one side compares against 0% (kind new/gone). A frame whose
// inclusive CPU share rose by ≥ thresholdPct is a regression, fell by ≥
// thresholdPct an improvement, and anything in between is noise and dropped.
// Raw-address frames (0x…) are excluded — ASLR makes them unmatchable across
// builds — and counted in a note.
func diffReports(baseline, current AnalyzeReport, thresholdPct float64) CompareReport {
	rep := CompareReport{
		Tool:         "xcprof",
		Version:      version,
		ThresholdPct: thresholdPct,
		Baseline:     compareSide(baseline),
		Current:      compareSide(current),
	}

	type pair struct{ base, cur *HotFrame }
	merged := map[string]*pair{}
	order := []string{}
	var skipped int
	index := func(frames []HotFrame, isCur bool) {
		for i := range frames {
			f := &frames[i]
			if strings.HasPrefix(f.Name, "0x") {
				skipped++
				continue
			}
			k := f.Binary + "\x00" + f.Name
			p := merged[k]
			if p == nil {
				p = &pair{}
				merged[k] = p
				order = append(order, k)
			}
			if isCur {
				p.cur = f
			} else {
				p.base = f
			}
		}
	}
	index(baseline.HotFrames, false)
	index(current.HotFrames, true)

	for _, k := range order {
		p := merged[k]
		d := frameDelta(p.base, p.cur)
		switch {
		case d.InclPctDelta >= thresholdPct:
			rep.Regressions = append(rep.Regressions, d)
		case d.InclPctDelta <= -thresholdPct:
			rep.Improvements = append(rep.Improvements, d)
		}
	}
	sortBySeverity(rep.Regressions)
	sortBySeverity(rep.Improvements)
	rep.Regressed = len(rep.Regressions) > 0
	// Capture the full counts before the display cap so a truncated list never
	// reads as "that's all of them" (the honesty contract — see the note below).
	regCount, impCount := len(rep.Regressions), len(rep.Improvements)
	if regCount > compareTopN {
		rep.Regressions = rep.Regressions[:compareTopN]
	}
	if impCount > compareTopN {
		rep.Improvements = rep.Improvements[:compareTopN]
	}

	if baseline.Network != nil || current.Network != nil {
		var b, c NetworkReport
		if baseline.Network != nil {
			b = *baseline.Network
		}
		if current.Network != nil {
			c = *current.Network
		}
		rep.Network = &NetworkDelta{
			BaselineRxBytes: b.TotalRxBytes, CurrentRxBytes: c.TotalRxBytes, RxBytesDelta: c.TotalRxBytes - b.TotalRxBytes,
			BaselineTxBytes: b.TotalTxBytes, CurrentTxBytes: c.TotalTxBytes, TxBytesDelta: c.TotalTxBytes - b.TotalTxBytes,
		}
	}

	if skipped > 0 {
		rep.Notes = append(rep.Notes, fmt.Sprintf(
			"%d unsymbolicated frame(s) excluded from matching (raw addresses don't match across builds); pass --dsym for symbol-level deltas", skipped))
	}
	if regCount > compareTopN {
		rep.Notes = append(rep.Notes, fmt.Sprintf(
			"%d regressions met the threshold; the top %d by severity are shown", regCount, compareTopN))
	}
	if impCount > compareTopN {
		rep.Notes = append(rep.Notes, fmt.Sprintf(
			"%d improvements found; the top %d by severity are shown", impCount, compareTopN))
	}
	if len(order) > 0 {
		rep.Notes = append(rep.Notes,
			"deltas are percentage-points of CPU-cycle share; ms deltas are approximate (sample-share × window); a frame absent from the other trace's top frames is treated as 0% (it may have been just below the top-frame cutoff)")
	}
	return rep
}

// frameDelta computes the delta for a matched (binary, name) pair. Either side
// may be nil (frame present in only one trace); the absent side reads as 0%.
func frameDelta(base, cur *HotFrame) FrameDelta {
	var d FrameDelta
	switch {
	case base != nil && cur != nil:
		d = FrameDelta{Name: cur.Name, Binary: cur.Binary, System: cur.System || base.System, Kind: "changed"}
	case cur != nil:
		d = FrameDelta{Name: cur.Name, Binary: cur.Binary, System: cur.System, Kind: "new"}
	default:
		d = FrameDelta{Name: base.Name, Binary: base.Binary, System: base.System, Kind: "gone"}
	}
	var bIncl, cIncl, bSelf, cSelf, bInclMS, cInclMS, bSelfMS, cSelfMS float64
	if base != nil {
		bIncl, bSelf, bInclMS, bSelfMS = base.InclusivePct, base.SelfPct, base.InclusiveMS, base.SelfMS
	}
	if cur != nil {
		cIncl, cSelf, cInclMS, cSelfMS = cur.InclusivePct, cur.SelfPct, cur.InclusiveMS, cur.SelfMS
	}
	d.BaselineInclPct = bIncl
	d.CurrentInclPct = cIncl
	d.InclPctDelta = round2(cIncl - bIncl)
	d.SelfPctDelta = round2(cSelf - bSelf)
	d.InclMSDelta = round1(cInclMS - bInclMS)
	d.SelfMSDelta = round1(cSelfMS - bSelfMS)
	d.Severity = round1(math.Abs(d.InclPctDelta) * math.Max(bInclMS, cInclMS))
	return d
}

func sortBySeverity(deltas []FrameDelta) {
	sort.SliceStable(deltas, func(i, j int) bool {
		if deltas[i].Severity != deltas[j].Severity {
			return deltas[i].Severity > deltas[j].Severity
		}
		return math.Abs(deltas[i].InclPctDelta) > math.Abs(deltas[j].InclPctDelta)
	})
}

func compareSide(r AnalyzeReport) CompareSide {
	s := CompareSide{Trace: r.Summary.Trace, DurationSec: r.Summary.DurationSec, CPUSamples: r.CPUSamples}
	if r.MainThread != nil {
		s.MainThreadPct = r.MainThread.WeightPct
	}
	return s
}
