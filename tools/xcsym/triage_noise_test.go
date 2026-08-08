package main

import "testing"

// Every rule in noiseRules must have BOTH a positive (want:true) and a
// negative (want:false) fixture — track them separately. Positive fixtures must
// also pin wantSafety: the emitted deprioritize_safety is a documented tool contract
// (production-triage.md noise-class table) that nothing else in the codebase
// reads. This pins the Go value only — it does not parse the markdown, so it
// cannot prove the table agrees. What it buys is that a safety change can
// never be silent: it forces a second deliberate edit here, which is the moment
// to update the table.
func TestNoiseRules_HaveFixtures(t *testing.T) {
	pos := map[string]bool{}
	neg := map[string]bool{}
	for _, c := range noiseFixtures {
		if c.want {
			pos[c.ruleID] = true
			if c.wantSafety == "" {
				t.Errorf("positive fixture for %q does not pin wantSafety", c.ruleID)
			}
		} else {
			neg[c.ruleID] = true
		}
	}
	for _, r := range noiseRules {
		if !pos[r.ID] {
			t.Errorf("noise rule %q has no positive fixture (want:true)", r.ID)
		}
		if !neg[r.ID] {
			t.Errorf("noise rule %q has no negative fixture (want:false)", r.ID)
		}
	}
}

type noiseCase struct {
	ruleID     string
	report     *NormalizedReport
	raw        *RawCrash
	cat        CategorizeResult
	th         Thresholds
	want       bool   // expect this ruleID to fire
	wantSafety string // emitted deprioritize_safety; required when want is true
}

// noiseFixtures is appended to by each rule task (D2–D6).
var noiseFixtures []noiseCase

func TestNoiseRules_Fixtures(t *testing.T) {
	for _, c := range noiseFixtures {
		flags := applyNoiseRules(c.report, c.raw, c.cat, c.th)
		fired := false
		for _, f := range flags {
			if f.RuleID != c.ruleID {
				continue
			}
			fired = true
			if c.wantSafety != "" && f.DeprioritizeSafety != c.wantSafety {
				t.Errorf("rule %q deprioritize_safety = %q want %q for case %q",
					c.ruleID, f.DeprioritizeSafety, c.wantSafety, c.report.IssueID)
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
		// medium, not high: the matcher is strict but stack shape alone cannot
		// separate a suspension artifact from a watchdog-terminated real hang
		// inside a system callout (Axiom-pfp).
		noiseCase{ruleID: "noise.anr_suspension.v1", report: &NormalizedReport{IssueID: "idle", Kind: "hang"},
			raw: idle, cat: categorizeHang(idle), want: true, wantSafety: "medium"},
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
		{"2.01", "2.1", 0}, {"2.1.0-beta", "2.1.0", 0}, // leading zero; non-numeric component → 0
		// Empty-string args: a missing/blank version is gated by the fixed_in_newer
		// rule's "" check, so compareVersions must treat "" as the 0-version.
		{"", "2.1.0", -1}, {"2.1.0", "", 1}, {"", "", 0}, {"", "0.0", 0},
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
			th: Thresholds{LatestVersion: "2.1.0"}, want: true, wantSafety: "low"},
		noiseCase{ruleID: "noise.fixed_in_newer.v1", report: current, raw: empty,
			th: Thresholds{LatestVersion: "2.1.0"}, want: false},
	)
}

func init() {
	// Background-thread crash, no app frames → low deprioritize-safety noise.
	bg := &RawCrash{Kind: "crash", CrashedIdx: 0, Threads: []Thread{
		{Index: 3, Triggered: true, Frames: []Frame{{Image: "ThirdPartySDK", Symbol: "explode"}}},
	}}
	// Main-thread crash with no app frames → NOT flagged (more suspicious).
	mainNoApp := &RawCrash{Kind: "crash", CrashedIdx: 0, Threads: []Thread{
		{Index: 0, Triggered: true, Frames: []Frame{{Image: "ThirdPartySDK", Symbol: "explode"}}},
	}}
	noiseFixtures = append(noiseFixtures,
		noiseCase{ruleID: "noise.third_party_only.v1", report: &NormalizedReport{IssueID: "bg", Kind: "crash"},
			raw: bg, cat: CategorizeResult{Tag: "bad_memory_access"}, want: true, wantSafety: "low"},
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
			th: Thresholds{OSFloor: "18.0"}, want: true, wantSafety: "medium"},
		noiseCase{ruleID: "noise.single_os_eol.v1", report: mixed, raw: empty,
			th: Thresholds{OSFloor: "18.0"}, want: false},
	)
}

func init() {
	small := &NormalizedReport{IssueID: "small", Kind: "crash", Impact: NRImpact{Users: 2}}
	big := &NormalizedReport{IssueID: "big", Kind: "crash", Impact: NRImpact{Users: 200}}
	empty := &RawCrash{}
	noiseFixtures = append(noiseFixtures,
		noiseCase{ruleID: "noise.long_tail.v1", report: small, raw: empty,
			th: Thresholds{MinUsers: 5}, want: true, wantSafety: "high"},
		noiseCase{ruleID: "noise.long_tail.v1", report: big, raw: empty,
			th: Thresholds{MinUsers: 5}, want: false},
	)
}
