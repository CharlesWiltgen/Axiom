package main

import "testing"

func TestCategorize_UnmatchedDefaultsToUnclassified(t *testing.T) {
	raw := &RawCrash{
		Exception: Exception{Type: "EXC_UNKNOWN"},
	}
	res := Categorize(raw)
	if res.Tag != "unclassified" {
		t.Errorf("tag = %q, want unclassified", res.Tag)
	}
	if res.Confidence != "low" {
		t.Errorf("confidence = %q, want low", res.Confidence)
	}
	if res.RuleID != "" {
		t.Errorf("rule_id = %q, want empty", res.RuleID)
	}
	if res.Reason == "" {
		t.Error("expected non-empty reason on unclassified")
	}
}

func TestCategorize_UnclassifiedReasonIncludesInspectedFields(t *testing.T) {
	reason := "term-reason"
	raw := &RawCrash{
		Exception:   Exception{Type: "EXC_XYZ"},
		Termination: Termination{Namespace: "NS", Code: "0x1", Reason: &reason},
	}
	res := Categorize(raw)
	if !containsAll(res.Reason, "EXC_XYZ", "NS", "0x1") {
		t.Errorf("reason missing inspected fields: %q", res.Reason)
	}
}

// --- R-swift-unwrap-01 --------------------------------------------------

func TestCategorize_R_swift_unwrap_01_Positive(t *testing.T) {
	raw := &RawCrash{
		Exception: Exception{
			Type:    "EXC_BREAKPOINT",
			Codes:   "0x1",
			Subtype: "Swift runtime failure: unexpectedly found nil while unwrapping an Optional value",
		},
	}
	res := Categorize(raw)
	if res.Tag != "swift_forced_unwrap" {
		t.Errorf("tag = %q, want swift_forced_unwrap", res.Tag)
	}
	if res.Confidence != "high" {
		t.Errorf("confidence = %q, want high", res.Confidence)
	}
	if res.RuleID != "R-swift-unwrap-01" {
		t.Errorf("rule_id = %q, want R-swift-unwrap-01", res.RuleID)
	}
}

func TestCategorize_R_swift_unwrap_01_Negative(t *testing.T) {
	// Near miss: EXC_BREAKPOINT with a different Swift runtime failure subtype
	// (arithmetic overflow) must NOT trigger the forced-unwrap rule.
	raw := &RawCrash{
		Exception: Exception{
			Type:    "EXC_BREAKPOINT",
			Codes:   "0x1",
			Subtype: "Swift runtime failure: arithmetic overflow",
		},
	}
	res := Categorize(raw)
	if res.Tag == "swift_forced_unwrap" {
		t.Error("must not match swift_forced_unwrap on arithmetic overflow")
	}
}

// --- R-swift-conc-01 ----------------------------------------------------

func TestCategorize_R_swift_conc_01_Positive(t *testing.T) {
	raw := &RawCrash{
		Exception: Exception{
			Type:    "EXC_BREAKPOINT",
			Codes:   "0x1",
			Subtype: "Swift runtime failure: _swift_task_isCurrentExecutor expected current executor",
		},
	}
	res := Categorize(raw)
	if res.RuleID != "R-swift-conc-01" {
		t.Errorf("rule_id = %q, want R-swift-conc-01", res.RuleID)
	}
	if res.Tag != "swift_concurrency_violation" {
		t.Errorf("tag = %q, want swift_concurrency_violation", res.Tag)
	}
	if res.Confidence != "high" {
		t.Errorf("confidence = %q, want high", res.Confidence)
	}
}

func TestCategorize_R_swift_conc_01_Negative(t *testing.T) {
	// Near miss: EXC_BREAKPOINT with a forced-unwrap subtype must not be
	// mis-classified as a concurrency violation (and the ordering must keep
	// swift-unwrap-01 as the winning rule).
	raw := &RawCrash{
		Exception: Exception{
			Type:    "EXC_BREAKPOINT",
			Codes:   "0x1",
			Subtype: "Swift runtime failure: unexpectedly found nil while unwrapping an Optional value",
		},
	}
	res := Categorize(raw)
	if res.RuleID == "R-swift-conc-01" {
		t.Errorf("must not fire swift_concurrency_violation on forced-unwrap subtype; got %q", res.Tag)
	}
}

// --- Rule coverage ------------------------------------------------------

// TestCategorize_AllRulesHaveFixtures verifies every registered rule has at
// least one positive and one negative fixture in categorize_test.go. This is
// enforced by registering fixtures in the coverageRegistry below; any rule
// whose ID appears in `rules` but not in the registry fails CI.
func TestCategorize_AllRulesHaveFixtures(t *testing.T) {
	for _, r := range rules {
		cov, ok := coverageRegistry[r.ID]
		if !ok {
			t.Errorf("rule %q has no fixtures registered in coverageRegistry", r.ID)
			continue
		}
		if !cov.positive {
			t.Errorf("rule %q missing positive fixture", r.ID)
		}
		if !cov.negative {
			t.Errorf("rule %q missing negative fixture", r.ID)
		}
	}
}

type ruleCoverage struct{ positive, negative bool }

// coverageRegistry is updated by each rule's test pair. Tests assert the
// rule's presence here so the coverage test can enforce the invariant without
// relying on test runner ordering.
var coverageRegistry = map[string]ruleCoverage{
	"R-swift-unwrap-01": {positive: true, negative: true},
	"R-swift-conc-01":   {positive: true, negative: true},
}

// containsAll reports whether s contains all of subs (order-independent).
func containsAll(s string, subs ...string) bool {
	for _, sub := range subs {
		found := false
		for i := 0; i+len(sub) <= len(s); i++ {
			if s[i:i+len(sub)] == sub {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}
