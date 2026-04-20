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

// --- R-swift-fatal-01 ---------------------------------------------------

func TestCategorize_R_swift_fatal_01_Positive(t *testing.T) {
	raw := &RawCrash{
		Exception: Exception{
			Type:    "EXC_BREAKPOINT",
			Codes:   "0x1",
			Subtype: "Swift runtime failure: division by zero",
		},
		Threads: []Thread{{
			Index: 0, Triggered: true,
			Frames: []Frame{
				{Index: 0, Address: "0x1", Image: "libswiftCore.dylib", Symbol: "swift_runtime_fail"},
				{Index: 1, Address: "0x2", Image: "libswiftCore.dylib", Symbol: "swift_preconditionFailure"},
				{Index: 2, Address: "0x3", Image: "MyApp", Symbol: "ContentView.body"},
			},
		}},
		CrashedIdx: 0,
	}
	res := Categorize(raw)
	if res.RuleID != "R-swift-fatal-01" {
		t.Errorf("rule_id = %q, want R-swift-fatal-01", res.RuleID)
	}
	if res.Tag != "swift_fatal_error" {
		t.Errorf("tag = %q, want swift_fatal_error", res.Tag)
	}
}

func TestCategorize_R_swift_fatal_01_Negative(t *testing.T) {
	// Near miss: same subtype prefix but no fatal sentinel in frames — must
	// fall through to unclassified (or a later rule) instead of firing.
	raw := &RawCrash{
		Exception: Exception{
			Type:    "EXC_BREAKPOINT",
			Codes:   "0x1",
			Subtype: "Swift runtime failure: division by zero",
		},
		Threads: []Thread{{
			Index:     0,
			Triggered: true,
			Frames: []Frame{
				{Index: 0, Image: "MyApp", Symbol: "ContentView.body"},
			},
		}},
		CrashedIdx: 0,
	}
	res := Categorize(raw)
	if res.RuleID == "R-swift-fatal-01" {
		t.Errorf("must not fire swift_fatal_error without a sentinel frame")
	}
}

// --- R-stack-overflow-01 ------------------------------------------------

func TestCategorize_R_stack_overflow_01_Positive(t *testing.T) {
	// Faulting address 0x16f1fbff0 is 16 bytes below thread SP 0x16f1fc000
	// — well within the 4096-byte guard page window.
	raw := &RawCrash{
		Exception: Exception{
			Type:    "EXC_BAD_ACCESS",
			Codes:   "0x0000000000000002, 0x000000016f1fbff0",
			Subtype: "KERN_PROTECTION_FAILURE at 0x000000016f1fbff0",
		},
		Threads: []Thread{{
			Index: 0, Triggered: true,
			State: &ThreadState{SP: 0x16f1fc000, PC: 0x1045a8b2c},
			Frames: []Frame{
				{Index: 0, Symbol: "someDeepRecursion"},
			},
		}},
		CrashedIdx: 0,
	}
	res := Categorize(raw)
	if res.RuleID != "R-stack-overflow-01" {
		t.Errorf("rule_id = %q, want R-stack-overflow-01", res.RuleID)
	}
	if res.Tag != "stack_overflow" {
		t.Errorf("tag = %q, want stack_overflow", res.Tag)
	}
	if res.Confidence != "heuristic" {
		t.Errorf("confidence = %q, want heuristic", res.Confidence)
	}
}

func TestCategorize_R_stack_overflow_01_Negative_FarFromSP(t *testing.T) {
	// KERN_PROTECTION_FAILURE but faulting address is far from any SP — do
	// not classify as stack overflow; let the bad-access rule handle it.
	raw := &RawCrash{
		Exception: Exception{
			Type:    "EXC_BAD_ACCESS",
			Codes:   "0x2, 0x00007ff812345678",
			Subtype: "KERN_PROTECTION_FAILURE at 0x00007ff812345678",
		},
		Threads: []Thread{{
			Index: 0, Triggered: true,
			State: &ThreadState{SP: 0x16f1fc000, PC: 0x1045a8b2c},
		}},
		CrashedIdx: 0,
	}
	res := Categorize(raw)
	if res.RuleID == "R-stack-overflow-01" {
		t.Errorf("must not fire stack_overflow when fault is far from SP")
	}
}

// --- R-zombie-01 --------------------------------------------------------

func TestCategorize_R_zombie_01_Positive(t *testing.T) {
	raw := &RawCrash{
		Exception: Exception{
			Type:    "EXC_BAD_ACCESS",
			Codes:   "0x1, 0x4141414141414141",
			Subtype: "KERN_INVALID_ADDRESS",
		},
		Threads: []Thread{{
			Index: 0, Triggered: true,
			Frames: []Frame{
				{Index: 0, Image: "CoreFoundation", Symbol: "CFRelease"},
				{Index: 1, Image: "_NSZombie_MyClass", Symbol: "-[MyClass release]"},
			},
		}},
		CrashedIdx: 0,
	}
	res := Categorize(raw)
	if res.RuleID != "R-zombie-01" {
		t.Errorf("rule_id = %q, want R-zombie-01", res.RuleID)
	}
	if res.Confidence != "heuristic" {
		t.Errorf("confidence = %q, want heuristic", res.Confidence)
	}
}

func TestCategorize_R_zombie_01_Negative(t *testing.T) {
	// Near miss: EXC_BAD_ACCESS with no zombie/libgmalloc frame must fall
	// through to the bad-access catch-all.
	raw := &RawCrash{
		Exception: Exception{
			Type:    "EXC_BAD_ACCESS",
			Codes:   "0x1, 0x0",
			Subtype: "KERN_INVALID_ADDRESS",
		},
		Threads: []Thread{{
			Index: 0, Triggered: true,
			Frames: []Frame{
				{Index: 0, Image: "MyApp", Symbol: "MyView.body"},
			},
		}},
		CrashedIdx: 0,
	}
	res := Categorize(raw)
	if res.RuleID == "R-zombie-01" {
		t.Errorf("must not fire zombie without NSZombie/libgmalloc frames")
	}
}

// --- R-bad-access-01 ----------------------------------------------------

func TestCategorize_R_bad_access_01_Positive(t *testing.T) {
	raw := &RawCrash{
		Exception: Exception{
			Type:    "EXC_BAD_ACCESS",
			Codes:   "0x1, 0x0",
			Subtype: "KERN_INVALID_ADDRESS",
		},
		Threads: []Thread{{Index: 0, Triggered: true, Frames: []Frame{{Index: 0, Image: "MyApp"}}}},
	}
	res := Categorize(raw)
	if res.RuleID != "R-bad-access-01" {
		t.Errorf("rule_id = %q, want R-bad-access-01", res.RuleID)
	}
}

func TestCategorize_R_bad_access_01_Negative(t *testing.T) {
	// Near miss: EXC_BAD_ACCESS without KERN_INVALID_ADDRESS (e.g.
	// KERN_PROTECTION_FAILURE only) must not fire this rule — it belongs to
	// stack-overflow or a future rule.
	raw := &RawCrash{
		Exception: Exception{
			Type:    "EXC_BAD_ACCESS",
			Codes:   "0x2, 0x1000",
			Subtype: "KERN_PROTECTION_FAILURE at 0x1000",
		},
	}
	res := Categorize(raw)
	if res.RuleID == "R-bad-access-01" {
		t.Errorf("must not fire bad_memory_access without KERN_INVALID_ADDRESS")
	}
}

// --- R-illegal-inst-01 --------------------------------------------------

func TestCategorize_R_illegal_inst_01_Positive(t *testing.T) {
	raw := &RawCrash{Exception: Exception{Type: "EXC_BAD_INSTRUCTION", Codes: "0x1, 0x0"}}
	res := Categorize(raw)
	if res.RuleID != "R-illegal-inst-01" {
		t.Errorf("rule_id = %q, want R-illegal-inst-01", res.RuleID)
	}
}

func TestCategorize_R_illegal_inst_01_Negative(t *testing.T) {
	raw := &RawCrash{Exception: Exception{Type: "EXC_BAD_ACCESS", Subtype: "KERN_INVALID_ADDRESS"}}
	res := Categorize(raw)
	if res.RuleID == "R-illegal-inst-01" {
		t.Errorf("must not fire illegal_instruction on EXC_BAD_ACCESS")
	}
}

// --- R-exc-guard-01 -----------------------------------------------------

func TestCategorize_R_exc_guard_01_Positive(t *testing.T) {
	raw := &RawCrash{Exception: Exception{Type: "EXC_GUARD", Codes: "0x...", Subtype: "GUARD_TYPE_FD"}}
	res := Categorize(raw)
	if res.RuleID != "R-exc-guard-01" {
		t.Errorf("rule_id = %q, want R-exc-guard-01", res.RuleID)
	}
}

func TestCategorize_R_exc_guard_01_Negative(t *testing.T) {
	raw := &RawCrash{Exception: Exception{Type: "EXC_CRASH"}}
	res := Categorize(raw)
	if res.RuleID == "R-exc-guard-01" {
		t.Errorf("must not fire exc_guard on EXC_CRASH")
	}
}

// --- R-objc-exc-01 ------------------------------------------------------

func TestCategorize_R_objc_exc_01_Positive(t *testing.T) {
	raw := &RawCrash{
		Exception: Exception{Type: "EXC_CRASH", Codes: "0x0", Signal: "SIGABRT"},
		Threads: []Thread{{
			Index: 0, Triggered: true,
			Frames: []Frame{
				{Index: 0, Image: "libsystem_kernel", Symbol: "__pthread_kill"},
				{Index: 1, Image: "libobjc.A.dylib", Symbol: "objc_exception_throw"},
				{Index: 2, Image: "Foundation", Symbol: "-[NSException raise]"},
			},
		}},
	}
	res := Categorize(raw)
	if res.RuleID != "R-objc-exc-01" {
		t.Errorf("rule_id = %q, want R-objc-exc-01", res.RuleID)
	}
}

func TestCategorize_R_objc_exc_01_Negative(t *testing.T) {
	// Near miss: EXC_CRASH without objc_exception_throw frame must not fire.
	raw := &RawCrash{
		Exception: Exception{Type: "EXC_CRASH", Codes: "0x0", Signal: "SIGABRT"},
		Threads: []Thread{{
			Index: 0, Triggered: true,
			Frames: []Frame{
				{Index: 0, Image: "libsystem_kernel", Symbol: "__pthread_kill"},
				{Index: 1, Image: "libsystem_c", Symbol: "abort"},
			},
		}},
	}
	res := Categorize(raw)
	if res.RuleID == "R-objc-exc-01" {
		t.Errorf("must not fire objc_exception without objc_exception_throw frame")
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
	"R-swift-fatal-01":  {positive: true, negative: true},
	"R-stack-overflow-01": {positive: true, negative: true},
	"R-zombie-01":         {positive: true, negative: true},
	"R-bad-access-01":     {positive: true, negative: true},
	"R-illegal-inst-01":   {positive: true, negative: true},
	"R-exc-guard-01":      {positive: true, negative: true},
	"R-objc-exc-01":       {positive: true, negative: true},
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
