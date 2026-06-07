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

func TestCompareVersions(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"2.1.0", "2.1.1", -1}, {"2.1.1", "2.1.0", 1}, {"2.1", "2.1.0", 0},
		{"2.1.0", "2.1", 0}, {"10.0", "9.9", 1}, {"2.1.1", "2.1.1", 0},
	}
	for _, c := range cases {
		if got := compareVersions(c.a, c.b); got != c.want {
			t.Errorf("compareVersions(%q,%q) = %d want %d", c.a, c.b, got, c.want)
		}
	}
}

func init() {
	fixed := &NormalizedReport{IssueID: "fixed", Kind: "crash", Versions: NRVersions{Max: "2.0.5"}}
	current := &NormalizedReport{IssueID: "current", Kind: "crash", Versions: NRVersions{Max: "2.1.0"}}
	empty := &RawCrash{}
	noiseFixtures = append(noiseFixtures,
		noiseCase{ruleID: "noise.fixed_in_newer.v1", report: fixed, raw: empty,
			th: Thresholds{LatestVersion: "2.1.0"}, want: true},
		noiseCase{ruleID: "noise.fixed_in_newer.v1", report: current, raw: empty,
			th: Thresholds{LatestVersion: "2.1.0"}, want: false},
	)
}

func init() {
	// Background-thread crash, no app frames → low-confidence noise.
	bg := &RawCrash{Kind: "crash", CrashedIdx: 0, Threads: []Thread{
		{Index: 3, Triggered: true, Frames: []Frame{{Image: "ThirdPartySDK", Symbol: "explode"}}},
	}}
	// Main-thread crash with no app frames → NOT flagged (more suspicious).
	mainNoApp := &RawCrash{Kind: "crash", CrashedIdx: 0, Threads: []Thread{
		{Index: 0, Triggered: true, Frames: []Frame{{Image: "ThirdPartySDK", Symbol: "explode"}}},
	}}
	noiseFixtures = append(noiseFixtures,
		noiseCase{ruleID: "noise.third_party_only.v1", report: &NormalizedReport{IssueID: "bg", Kind: "crash"},
			raw: bg, cat: CategorizeResult{Tag: "bad_memory_access"}, want: true},
		noiseCase{ruleID: "noise.third_party_only.v1", report: &NormalizedReport{IssueID: "mainNoApp", Kind: "crash"},
			raw: mainNoApp, cat: CategorizeResult{Tag: "bad_memory_access"}, want: false},
	)
}

func init() {
	eol := &NormalizedReport{IssueID: "eol", Kind: "crash", OS: NROS{Versions: []string{"17.2", "17.5"}}}
	mixed := &NormalizedReport{IssueID: "mixed", Kind: "crash", OS: NROS{Versions: []string{"17.5", "18.0"}}}
	empty := &RawCrash{}
	noiseFixtures = append(noiseFixtures,
		noiseCase{ruleID: "noise.single_os_eol.v1", report: eol, raw: empty,
			th: Thresholds{OSFloor: "18.0"}, want: true},
		noiseCase{ruleID: "noise.single_os_eol.v1", report: mixed, raw: empty,
			th: Thresholds{OSFloor: "18.0"}, want: false},
	)
}
