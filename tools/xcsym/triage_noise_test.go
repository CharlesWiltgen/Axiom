package main

import "testing"

// Every rule in noiseRules must have a positive and negative fixture here.
func TestNoiseRules_HaveFixtures(t *testing.T) {
	covered := map[string]bool{}
	for _, c := range noiseFixtures {
		covered[c.ruleID] = true
	}
	for _, r := range noiseRules {
		if !covered[r.ID] {
			t.Errorf("noise rule %q has no fixtures in noiseFixtures", r.ID)
		}
	}
}

type noiseCase struct {
	ruleID string
	report *NormalizedReport
	raw    *RawCrash
	cat    CategorizeResult
	th     Thresholds
	want   bool // expect this ruleID to fire
}

// noiseFixtures is appended to by each rule task (D2–D6).
var noiseFixtures []noiseCase

func TestNoiseRules_Fixtures(t *testing.T) {
	for _, c := range noiseFixtures {
		flags := applyNoiseRules(c.report, c.raw, c.cat, c.th)
		fired := false
		for _, f := range flags {
			if f.RuleID == c.ruleID {
				fired = true
			}
		}
		if fired != c.want {
			t.Errorf("rule %q fired=%v want=%v for case %+v", c.ruleID, fired, c.want, c.report.IssueID)
		}
	}
}
