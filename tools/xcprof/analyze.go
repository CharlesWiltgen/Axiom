package main

import "sort"

type familyDef struct {
	name    string
	schemas []string
}

// families maps a diagnostic family to the export schemas that satisfy it.
var families = []familyDef{
	{"cpu", []string{"cpu-profile"}},
	{"memory", []string{"allocations", "leaks"}},
	{"network", []string{"http-traffic", "network-connections"}},
	{"energy", []string{"power", "energy-model", "location-energy-model"}},
	{"hangs", []string{"hangs", "microstackshots"}},
}

// supportMatrix reports, per family, whether xcprof measured it. cpu is
// available when samples parsed; a family whose schema is present but not yet
// parsed by this version is `partial` with a note; absent schemas are
// `not_present`. This is the honesty contract — silence never reads as "clean".
func supportMatrix(toc *TOC, cpuSamples int) []FamilyStatus {
	out := make([]FamilyStatus, 0, len(families))
	for _, fam := range families {
		present := false
		for _, s := range fam.schemas {
			if toc.hasSchema(s) {
				present = true
				break
			}
		}
		switch {
		case fam.name == "cpu" && present && cpuSamples > 0:
			out = append(out, FamilyStatus{Family: fam.name, Status: statusAvailable})
		case fam.name == "cpu" && present:
			out = append(out, FamilyStatus{Family: fam.name, Status: statusPartial, Note: "cpu-profile table present but no samples parsed"})
		case present:
			out = append(out, FamilyStatus{Family: fam.name, Status: statusPartial, Note: "schema present; parsing arrives in a later xcprof version"})
		default:
			out = append(out, FamilyStatus{Family: fam.name, Status: statusNotPresent})
		}
	}
	return out
}

// HotFrame aggregates one function across all samples.
type HotFrame struct {
	Name      string `json:"name"`
	Binary    string `json:"binary,omitempty"`
	Inclusive int64  `json:"inclusive"` // weight where this frame appears anywhere in the stack
	Self      int64  `json:"self"`      // weight where this frame is the leaf
	Samples   int    `json:"samples"`   // samples where it appears
	System    bool   `json:"system"`
}

// MainThreadStats summarizes main-thread activity. The hang signal is
// approximate: cpu-profile only samples running threads, so a large gap
// between consecutive main-thread samples is a *candidate* stall, not a
// confirmed hang (the Hangs instrument, Phase 2, confirms).
type MainThreadStats struct {
	Samples         int   `json:"samples"`
	Weight          int64 `json:"weight"`
	MaxGapMS        int64 `json:"max_gap_ms"`
	GapThresholdMS  int64 `json:"gap_threshold_ms"`
	CandidateStalls int   `json:"candidate_stalls"`
}

// scopeByTime keeps samples whose timestamp falls within [startMS, endMS].
// A zero endMS means "no upper bound".
func scopeByTime(samples []Sample, startMS, endMS int64) []Sample {
	if startMS <= 0 && endMS <= 0 {
		return samples
	}
	out := make([]Sample, 0, len(samples))
	for _, s := range samples {
		ms := s.TimeNS / 1_000_000
		if ms < startMS {
			continue
		}
		if endMS > 0 && ms > endMS {
			continue
		}
		out = append(out, s)
	}
	return out
}

func frameKey(f Frame) string { return f.BinaryName + "\x00" + f.Name }

// aggregateHotFrames sums inclusive (anywhere-in-stack) and self (leaf) weight
// per function, returning the top `limit` by inclusive weight.
func aggregateHotFrames(samples []Sample, limit int) []HotFrame {
	type acc struct {
		HotFrame
		lastSeenGen int // 1-based sample index this frame was last counted in
	}
	byKey := map[string]*acc{}
	order := []string{}
	for i, s := range samples {
		gen := i + 1 // 1-based so the zero-value lastSeenGen never matches
		for depth, f := range s.Frames {
			k := frameKey(f)
			a := byKey[k]
			if a == nil {
				a = &acc{HotFrame: HotFrame{Name: f.Name, Binary: f.BinaryName, System: isSystemFrame(f)}}
				byKey[k] = a
				order = append(order, k)
			}
			a.Inclusive += s.Weight
			if depth == 0 {
				a.Self += s.Weight
			}
			// Count each distinct sample once per frame (a frame can appear
			// twice in one recursive stack); the generation guard avoids the
			// O(samples*frames) reset pass.
			if a.lastSeenGen != gen {
				a.Samples++
				a.lastSeenGen = gen
			}
		}
	}
	out := make([]HotFrame, 0, len(order))
	for _, k := range order {
		out = append(out, byKey[k].HotFrame)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Inclusive != out[j].Inclusive {
			return out[i].Inclusive > out[j].Inclusive
		}
		return out[i].Self > out[j].Self
	})
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out
}

// topUserFrames returns the hottest app-attributed frames by self weight.
func topUserFrames(samples []Sample, userBinaries map[string]bool, limit int) []HotFrame {
	all := aggregateHotFrames(samples, 0)
	user := make([]HotFrame, 0, len(all))
	for _, hf := range all {
		if !attributedAsUser(hf.System, hf.Binary, userBinaries) {
			continue
		}
		user = append(user, hf)
	}
	sort.SliceStable(user, func(i, j int) bool {
		if user[i].Self != user[j].Self {
			return user[i].Self > user[j].Self
		}
		return user[i].Inclusive > user[j].Inclusive
	})
	if limit > 0 && len(user) > limit {
		user = user[:limit]
	}
	return user
}

// mainThreadStats summarizes main-thread samples and the largest inter-sample
// gap (the approximate stall signal).
func mainThreadStats(samples []Sample, gapThresholdMS int64) MainThreadStats {
	if gapThresholdMS <= 0 {
		gapThresholdMS = 250
	}
	st := MainThreadStats{GapThresholdMS: gapThresholdMS}
	var lastNS int64 = -1
	for _, s := range samples {
		if !s.IsMainThread {
			continue
		}
		st.Samples++
		st.Weight += s.Weight
		if lastNS >= 0 {
			gapMS := (s.TimeNS - lastNS) / 1_000_000
			if gapMS > st.MaxGapMS {
				st.MaxGapMS = gapMS
			}
			if gapMS >= gapThresholdMS {
				st.CandidateStalls++
			}
		}
		lastNS = s.TimeNS
	}
	return st
}
