package main

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
