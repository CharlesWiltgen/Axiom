package main

import (
	"strconv"
	"strings"
)

// NoiseRule is a predicate over the full issue context. Match returns
// (fired, confidence, reason).
type NoiseRule struct {
	ID    string
	Class string
	Match func(r *NormalizedReport, raw *RawCrash, cat CategorizeResult, th Thresholds) (bool, string, string)
}

// noiseRules is appended to by D2–D6. Order is not significant: every rule is
// evaluated and all firing flags are returned (flag-never-hide; an issue can
// carry multiple flags).
var noiseRules []NoiseRule

func applyNoiseRules(r *NormalizedReport, raw *RawCrash, cat CategorizeResult, th Thresholds) []NoiseFlag {
	// Non-nil empty so an issue with no noise flags marshals "noise_flags": []
	// not null — the field has no omitempty (flag-never-hide keeps it an array
	// consumers can always iterate).
	flags := []NoiseFlag{}
	for _, nr := range noiseRules {
		if ok, conf, reason := nr.Match(r, raw, cat, th); ok {
			flags = append(flags, NoiseFlag{Class: nr.Class, RuleID: nr.ID, Confidence: conf, Reason: reason})
		}
	}
	return flags
}

func init() {
	noiseRules = append(noiseRules, NoiseRule{
		ID: "noise.anr_suspension.v1", Class: "anr_suspension_false_positive",
		Match: func(r *NormalizedReport, raw *RawCrash, cat CategorizeResult, th Thresholds) (bool, string, string) {
			if r.Kind != "hang" {
				return false, "", ""
			}
			if !isIdleRunloop(raw) {
				return false, "", ""
			}
			return true, "high",
				"main-thread top frames are run-loop park signatures with no app work in the top 20; consistent with background suspension, not a real block"
		},
	})
}

// compareVersions compares dotted numeric versions component-wise. Missing
// trailing components are treated as 0 ("2.1" == "2.1.0"). Non-numeric
// components compare as 0. Returns -1, 0, or 1.
func compareVersions(a, b string) int {
	as, bs := strings.Split(a, "."), strings.Split(b, ".")
	n := len(as)
	if len(bs) > n {
		n = len(bs)
	}
	for i := 0; i < n; i++ {
		var ai, bi int
		if i < len(as) {
			ai, _ = strconv.Atoi(as[i])
		}
		if i < len(bs) {
			bi, _ = strconv.Atoi(bs[i])
		}
		if ai < bi {
			return -1
		}
		if ai > bi {
			return 1
		}
	}
	return 0
}

func init() {
	noiseRules = append(noiseRules, NoiseRule{
		ID: "noise.fixed_in_newer.v1", Class: "fixed_in_newer_build",
		Match: func(r *NormalizedReport, raw *RawCrash, cat CategorizeResult, th Thresholds) (bool, string, string) {
			if th.LatestVersion == "" || r.Versions.Max == "" {
				return false, "", ""
			}
			if compareVersions(r.Versions.Max, th.LatestVersion) < 0 {
				return true, "high",
					"highest affected version " + r.Versions.Max + " predates latest shipped " + th.LatestVersion + "; may already be fixed"
			}
			return false, "", ""
		},
	})
}

func init() {
	noiseRules = append(noiseRules, NoiseRule{
		ID: "noise.third_party_only.v1", Class: "third_party_or_system_only",
		Match: func(r *NormalizedReport, raw *RawCrash, cat CategorizeResult, th Thresholds) (bool, string, string) {
			if r.Kind != "crash" {
				return false, "", ""
			}
			if raw.CrashedIdx < 0 || raw.CrashedIdx >= len(raw.Threads) {
				return false, "", ""
			}
			crashed := raw.Threads[raw.CrashedIdx]
			if crashed.Index == 0 { // main-thread no-app-frame crashes are more suspicious
				return false, "", ""
			}
			for _, f := range crashed.Frames {
				if f.InApp {
					return false, "", ""
				}
			}
			if len(crashed.Frames) == 0 {
				return false, "", ""
			}
			return true, "low",
				"crashed thread (non-main) has no app frames; not directly actionable in your code — but a third-party SDK can crash on a value app code passed it, so verify before dismissing"
		},
	})
}

func init() {
	noiseRules = append(noiseRules, NoiseRule{
		ID: "noise.single_os_eol.v1", Class: "single_os_eol",
		Match: func(r *NormalizedReport, raw *RawCrash, cat CategorizeResult, th Thresholds) (bool, string, string) {
			if th.OSFloor == "" || len(r.OS.Versions) == 0 {
				return false, "", ""
			}
			for _, v := range r.OS.Versions {
				if compareVersions(v, th.OSFloor) >= 0 {
					return false, "", "" // at least one supported OS → not EOL-only
				}
			}
			return true, "medium",
				"all affected OS versions are below the support floor " + th.OSFloor + "; deprioritize"
		},
	})
}
