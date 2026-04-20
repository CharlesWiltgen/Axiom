package main

import (
	"encoding/json"
	"fmt"
)

// Format tiers. `standard` is the default; summary is the size-constrained
// shape humans (and LLMs) look at when triaging large crash catalogs; full
// is the kitchen sink when a specific crash warrants deep inspection.
const (
	TierSummary  = "summary"
	TierStandard = "standard"
	TierFull     = "full"
)

// standardOtherThreadsBudget caps how many app frames we surface from
// non-crashed threads in the standard tier. 20 matches the plan and keeps
// representative .ips reports under the 12 KB budget.
const standardOtherThreadsBudget = 20

// summaryCrashedFrames is the cap for crashed-thread frames in the summary
// tier — enough to show the fault + one or two callers.
const summaryCrashedFrames = 5

// sizeWarningThresholdsByTier maps each tier to the marshaled-byte ceiling
// past which SizeWarning fires. Values are deliberately higher than the
// "design target" the docs advertise: real iOS .ips files run 25-380 KB
// and a standard-tier output for a framework-heavy app with 100+ used
// images regularly lands at 20-40 KB. The warning fires past a realistic
// threshold so users (a) get an informative signal when a crash is unusually
// large, (b) don't see noise on every routine production crash. axiom-51j.
//
// Design targets (advertised; aspirational):
//
//	summary  ~ 2 KB   warns past 4 KB   — strict cap, contains image_summary
//	standard ~12 KB   warns past 50 KB  — full images array dominates
//	full      n/a     warns past 100 KB — all_threads + full images
//
// Per-image cost (~150-300 bytes from arch/base/name/path/size/source/uuid)
// drives the standard-tier sizing; field reports show 45-150 used images
// per process is the typical range.
var sizeWarningThresholdsByTier = map[string]int{
	TierSummary:  4 * 1024,
	TierStandard: 50 * 1024,
	TierFull:     100 * 1024,
}

// nextSmallerTier returns the tier name to suggest in a size_warning hint:
// when full overflows, switch to standard; when standard overflows, switch
// to summary; summary has no smaller alternative.
func nextSmallerTier(tier string) string {
	switch tier {
	case TierFull:
		return TierStandard
	case TierStandard:
		return TierSummary
	}
	return ""
}

// Format produces a CrashReport from pipeline state. Tier controls the level
// of detail — see TierSummary/TierStandard/TierFull.
//
// The `input` and `cat` arguments are threaded through rather than stamped
// inside because the crash subcommand owns knowledge of the source path/
// format and the categorize pass runs before format.
func Format(raw *RawCrash, images ImageStatus, env Environment, input InputInfo, cat CategorizeResult, tier string) (CrashReport, error) {
	switch tier {
	case TierSummary, TierStandard, TierFull:
	default:
		return CrashReport{}, fmt.Errorf("unknown tier %q (want summary|standard|full)", tier)
	}

	report := CrashReport{
		Tool:        "xcsym",
		Version:     version,
		Format:      tier,
		Environment: environmentForTier(env, tier),
		Input:       input,
		Crash:       buildCrashInfoForTier(raw, images, cat, tier),
		Warnings:    []string{},
	}
	if tier == TierSummary {
		s := summarizeImages(images)
		report.ImagesSummary = &s
	} else {
		// Standard and full emit the full image breakdown. Defensive copy so
		// callers can safely mutate their own images after calling Format.
		copy := images
		report.Images = &copy
	}

	// All tiers: check for oversized output and annotate. We don't
	// truncate — the contract is informational, not enforcing. Each tier
	// has its own threshold (see sizeWarningThresholdsByTier); summary
	// tops out at 4 KB, standard at 50 KB, full at 100 KB.
	if threshold, ok := sizeWarningThresholdsByTier[tier]; ok {
		if buf, err := json.Marshal(report); err == nil && len(buf) > threshold {
			var hint string
			if smaller := nextSmallerTier(tier); smaller != "" {
				hint = fmt.Sprintf("; consider --format=%s for triage", smaller)
			}
			w := fmt.Sprintf("report size %d bytes exceeds %d bytes%s", len(buf), threshold, hint)
			report.SizeWarning = &w
		}
	}

	return report, nil
}

// environmentForTier returns the subset of environment metadata each tier
// should expose. Summary strips everything except a short CLT identifier to
// preserve its 2 KB budget.
func environmentForTier(env Environment, tier string) Environment {
	if tier == TierSummary {
		short := env.CLTVersionShort
		if short == "" {
			short = env.CLTVersion // fall back when the short form wasn't computed
		}
		return Environment{CLTVersionShort: short}
	}
	return env
}

// summarizeImages collapses an ImageStatus to counts-only for the summary
// tier.
func summarizeImages(s ImageStatus) ImagesSummary {
	return ImagesSummary{
		MatchedCount:    len(s.Matched),
		MismatchedCount: len(s.Mismatched),
		MissingCount:    len(s.Missing),
	}
}

// buildCrashInfoForTier constructs the Crash block according to tier rules:
//
//	summary:  crashed thread top-5 frames; no other-threads; no all_threads
//	standard: full crashed thread; top-20 app frames from other threads
//	full:     full crashed thread + all_threads (the superset — no
//	          other_threads_top_frames, which would duplicate what all_threads
//	          already carries). axiom-uya.
func buildCrashInfoForTier(raw *RawCrash, images ImageStatus, cat CategorizeResult, tier string) CrashInfo {
	var info CrashInfo
	if raw == nil {
		return info
	}
	info.App = raw.App
	info.OS = raw.OS
	info.Arch = raw.Arch
	info.Exception = raw.Exception
	info.Termination = raw.Termination
	info.PatternTag = cat.Tag
	info.PatternConfidence = cat.Confidence
	info.PatternRuleID = cat.RuleID
	info.PatternReason = cat.Reason

	crashed := crashedThreadOrEmpty(raw)
	switch tier {
	case TierSummary:
		info.CrashedThread = truncateThreadFrames(crashed, summaryCrashedFrames)
	case TierStandard, TierFull:
		info.CrashedThread = crashed
	}

	// other_threads_top_frames: standard only. The full tier's all_threads
	// already contains every frame, so adding OtherThreadsTopFrames would
	// duplicate data and inflate payload size.
	if tier == TierStandard {
		info.OtherThreadsTopFrames = collectOtherThreadsTopFrames(
			raw, images, standardOtherThreadsBudget)
	}

	// all_threads: full only.
	if tier == TierFull {
		info.AllThreads = raw.Threads
	}

	return info
}

func crashedThreadOrEmpty(raw *RawCrash) Thread {
	if raw.CrashedIdx < 0 || raw.CrashedIdx >= len(raw.Threads) {
		return Thread{Index: -1}
	}
	return raw.Threads[raw.CrashedIdx]
}

func truncateThreadFrames(t Thread, n int) Thread {
	if len(t.Frames) <= n {
		return t
	}
	out := t
	out.Frames = t.Frames[:n]
	return out
}

// collectOtherThreadsTopFrames walks non-crashed threads in index order and
// collects up to `limit` frames whose image is considered "app-owned" —
// either the main binary (first used image) or any image we successfully
// resolved a dSYM for (images.Matched). Frames from system libraries are
// skipped to keep reports focused.
func collectOtherThreadsTopFrames(raw *RawCrash, images ImageStatus, limit int) []ThreadTop {
	if limit <= 0 || len(raw.Threads) == 0 {
		return nil
	}
	appImages := make(map[string]bool)
	if len(raw.UsedImages) > 0 {
		appImages[raw.UsedImages[0].Name] = true
	}
	for _, m := range images.Matched {
		if m.Name != "" {
			appImages[m.Name] = true
		}
	}

	var out []ThreadTop
	remaining := limit
	for i, t := range raw.Threads {
		if i == raw.CrashedIdx {
			continue
		}
		if remaining <= 0 {
			break
		}
		var frames []Frame
		for _, f := range t.Frames {
			if remaining <= 0 {
				break
			}
			if appImages[f.Image] {
				frames = append(frames, f)
				remaining--
			}
		}
		if len(frames) > 0 {
			out = append(out, ThreadTop{Index: i, Frames: frames})
		}
	}
	return out
}
