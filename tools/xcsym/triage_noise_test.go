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

func init() {
	idle := hangRaw([]Frame{
		{Image: "libsystem_kernel.dylib", Symbol: "mach_msg2_trap"},
		{Image: "CoreFoundation", Symbol: "CFRunLoopRun"},
	})
	deadlock := hangRaw([]Frame{
		{Image: "libsystem_kernel.dylib", Symbol: "mach_msg2_trap"},
		{Image: "libdispatch.dylib", Symbol: "_dispatch_sync_f_slow"},
		{Image: "MyApp", Symbol: "ViewModel.load()", InApp: true},
	})
	noiseFixtures = append(noiseFixtures,
		noiseCase{ruleID: "noise.anr_suspension.v1", report: &NormalizedReport{IssueID: "idle", Kind: "hang"},
			raw: idle, cat: categorizeHang(idle), want: true},
		noiseCase{ruleID: "noise.anr_suspension.v1", report: &NormalizedReport{IssueID: "deadlock", Kind: "hang"},
			raw: deadlock, cat: categorizeHang(deadlock), want: false},
	)
}
