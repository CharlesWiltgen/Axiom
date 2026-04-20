package main

import (
	"testing"
)

// TestRoundTripEquivalence parses paired .ips and MetricKit fixtures
// representing the same underlying crash and asserts that Categorize
// returns the same rule_id for both. If a pair's categorization
// diverges, the bug is in the format adapter losing signal — not in
// this test.
//
// Per the plan, ≥5 rule_ids must be covered. Each pair is a thin proxy
// for a common production crash shape:
//
//	R-swift-unwrap-01   — Swift runtime forced-unwrap failure
//	R-bad-access-01     — dereferencing an invalid pointer
//	R-illegal-inst-01   — unknown/illegal CPU instruction
//	R-watchdog-01       — foreground watchdog (0x8BADF00D)
//	R-user-quit-01      — user force-quit from App Switcher (0xDEADFA11)
func TestRoundTripEquivalence(t *testing.T) {
	pairs := []struct {
		name     string
		ipsPath  string
		mkPath   string
		wantRule string
	}{
		{
			name:     "swift_forced_unwrap",
			ipsPath:  "crashes/ips_v2/swift_forced_unwrap.ips",
			mkPath:   "crashes/metrickit/swift_forced_unwrap.json",
			wantRule: "R-swift-unwrap-01",
		},
		{
			name:     "bad_memory_access",
			ipsPath:  "crashes/ips_v2/bad_memory_access.ips",
			mkPath:   "crashes/metrickit/bad_memory_access.json",
			wantRule: "R-bad-access-01",
		},
		{
			name:     "illegal_instruction",
			ipsPath:  "crashes/ips_v2/illegal_instruction.ips",
			mkPath:   "crashes/metrickit/illegal_instruction.json",
			wantRule: "R-illegal-inst-01",
		},
		{
			name:     "watchdog_termination",
			ipsPath:  "crashes/ips_v2/watchdog_termination.ips",
			mkPath:   "crashes/metrickit/watchdog_termination.json",
			wantRule: "R-watchdog-01",
		},
		{
			name:     "user_force_quit",
			ipsPath:  "crashes/ips_v2/user_force_quit.ips",
			mkPath:   "crashes/metrickit/user_force_quit.json",
			wantRule: "R-user-quit-01",
		},
	}

	for _, p := range pairs {
		t.Run(p.name, func(t *testing.T) {
			ipsCrash, err := ParseIPS(readFixture(t, p.ipsPath))
			if err != nil {
				t.Fatalf("ParseIPS: %v", err)
			}
			mkCrash, err := ParseMetricKit(readFixture(t, p.mkPath))
			if err != nil {
				t.Fatalf("ParseMetricKit: %v", err)
			}

			ipsRes := Categorize(ipsCrash)
			mkRes := Categorize(mkCrash)

			if ipsRes.RuleID != p.wantRule {
				t.Errorf(".ips rule = %q, want %q (tag=%q reason=%q)",
					ipsRes.RuleID, p.wantRule, ipsRes.Tag, ipsRes.Reason)
			}
			if mkRes.RuleID != p.wantRule {
				t.Errorf("metrickit rule = %q, want %q (tag=%q reason=%q)",
					mkRes.RuleID, p.wantRule, mkRes.Tag, mkRes.Reason)
			}
			if ipsRes.RuleID != mkRes.RuleID {
				t.Errorf("format divergence: .ips=%q, metrickit=%q — adapter is losing signal",
					ipsRes.RuleID, mkRes.RuleID)
			}
			// Tag must match too. Reason text is format-dependent (the
			// rule quotes which substring matched, and the subtype wording
			// may differ), so we don't compare it.
			if ipsRes.Tag != mkRes.Tag {
				t.Errorf("tag divergence: .ips=%q, metrickit=%q", ipsRes.Tag, mkRes.Tag)
			}
		})
	}
}
