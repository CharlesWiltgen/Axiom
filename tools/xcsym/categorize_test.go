package main

import "testing"

// --- Engine behaviour (not tied to a specific rule) ---------------------

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

// --- Rule fixture table -------------------------------------------------
//
// Every rule registered in `rules` must appear here with ≥1 positive and ≥1
// negative fixture. The TestCategorize_Rules aggregator enforces this
// mechanically — a rule added without fixtures fails CI, and fixtures that
// reference a nonexistent rule also fail. This replaces an earlier
// hand-maintained coverage map that could drift out of sync with reality.

type ruleCase struct {
	name string
	// make constructs the fixture lazily so rules with large programmatic
	// frame slices (e.g. R-swiftui-loop-01) don't allocate unless the test
	// actually runs.
	make func() *RawCrash
	// Optional positive-only assertions. Zero-value skips the check.
	wantTag        string
	wantConfidence string
}

type ruleTable struct {
	ruleID   string
	positive []ruleCase
	negative []ruleCase
}

var ruleFixtures = []ruleTable{
	{
		ruleID: "R-swift-unwrap-01",
		positive: []ruleCase{
			{
				name: "unwrap_optional", wantTag: "swift_forced_unwrap", wantConfidence: "high",
				make: func() *RawCrash {
					return &RawCrash{Exception: Exception{
						Type: "EXC_BREAKPOINT", Codes: "0x1",
						Subtype: "Swift runtime failure: unexpectedly found nil while unwrapping an Optional value",
					}}
				},
			},
		},
		negative: []ruleCase{
			{name: "arithmetic_overflow", make: func() *RawCrash {
				return &RawCrash{Exception: Exception{
					Type: "EXC_BREAKPOINT", Codes: "0x1",
					Subtype: "Swift runtime failure: arithmetic overflow",
				}}
			}},
		},
	},
	{
		ruleID: "R-swift-conc-01",
		positive: []ruleCase{
			{
				name: "is_current_executor", wantTag: "swift_concurrency_violation", wantConfidence: "high",
				make: func() *RawCrash {
					return &RawCrash{Exception: Exception{
						Type: "EXC_BREAKPOINT", Codes: "0x1",
						Subtype: "Swift runtime failure: _swift_task_isCurrentExecutor expected current executor",
					}}
				},
			},
		},
		negative: []ruleCase{
			// Near-miss: unwrap subtype must fire R-swift-unwrap-01, not
			// R-swift-conc-01. Ordering preserves that.
			{name: "forced_unwrap_subtype", make: func() *RawCrash {
				return &RawCrash{Exception: Exception{
					Type: "EXC_BREAKPOINT", Codes: "0x1",
					Subtype: "Swift runtime failure: unexpectedly found nil while unwrapping an Optional value",
				}}
			}},
		},
	},
	{
		ruleID: "R-swift-fatal-01",
		positive: []ruleCase{
			{
				name: "preconditionFailure_sentinel", wantTag: "swift_fatal_error", wantConfidence: "high",
				make: func() *RawCrash {
					return &RawCrash{
						Exception: Exception{
							Type: "EXC_BREAKPOINT", Codes: "0x1",
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
				},
			},
		},
		negative: []ruleCase{
			// Same subtype prefix but no fatal sentinel frame — must not fire.
			{name: "no_sentinel_frame", make: func() *RawCrash {
				return &RawCrash{
					Exception: Exception{
						Type: "EXC_BREAKPOINT", Codes: "0x1",
						Subtype: "Swift runtime failure: division by zero",
					},
					Threads: []Thread{{
						Index: 0, Triggered: true,
						Frames: []Frame{{Index: 0, Image: "MyApp", Symbol: "ContentView.body"}},
					}},
					CrashedIdx: 0,
				}
			}},
		},
	},
	{
		ruleID: "R-zombie-01",
		positive: []ruleCase{
			{
				name: "NSZombie_frame", wantConfidence: "heuristic",
				make: func() *RawCrash {
					return &RawCrash{
						Exception: Exception{
							Type: "EXC_BAD_ACCESS", Codes: "0x1, 0x4141414141414141",
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
				},
			},
		},
		negative: []ruleCase{
			{name: "plain_bad_access_no_zombie", make: func() *RawCrash {
				return &RawCrash{
					Exception: Exception{
						Type: "EXC_BAD_ACCESS", Codes: "0x1, 0x0",
						Subtype: "KERN_INVALID_ADDRESS",
					},
					Threads: []Thread{{
						Index: 0, Triggered: true,
						Frames: []Frame{{Index: 0, Image: "MyApp", Symbol: "MyView.body"}},
					}},
					CrashedIdx: 0,
				}
			}},
		},
	},
	{
		ruleID: "R-stack-overflow-01",
		positive: []ruleCase{
			{
				name: "fault_within_page_of_SP", wantTag: "stack_overflow", wantConfidence: "heuristic",
				make: func() *RawCrash {
					return &RawCrash{
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
				},
			},
		},
		negative: []ruleCase{
			// KERN_PROTECTION_FAILURE but fault is far from any SP — bail out.
			{name: "far_from_sp", make: func() *RawCrash {
				return &RawCrash{
					Exception: Exception{
						Type: "EXC_BAD_ACCESS", Codes: "0x2, 0x00007ff812345678",
						Subtype: "KERN_PROTECTION_FAILURE at 0x00007ff812345678",
					},
					Threads: []Thread{{
						Index: 0, Triggered: true,
						State: &ThreadState{SP: 0x16f1fc000, PC: 0x1045a8b2c},
					}},
					CrashedIdx: 0,
				}
			}},
		},
	},
	{
		ruleID: "R-bad-access-01",
		positive: []ruleCase{
			{name: "KERN_INVALID_ADDRESS", make: func() *RawCrash {
				return &RawCrash{
					Exception: Exception{
						Type: "EXC_BAD_ACCESS", Codes: "0x1, 0x0",
						Subtype: "KERN_INVALID_ADDRESS",
					},
					Threads: []Thread{{Index: 0, Triggered: true, Frames: []Frame{{Index: 0, Image: "MyApp"}}}},
				}
			}},
		},
		negative: []ruleCase{
			{name: "KERN_PROTECTION_FAILURE_only", make: func() *RawCrash {
				return &RawCrash{
					Exception: Exception{
						Type: "EXC_BAD_ACCESS", Codes: "0x2, 0x1000",
						Subtype: "KERN_PROTECTION_FAILURE at 0x1000",
					},
				}
			}},
		},
	},
	{
		ruleID: "R-illegal-inst-01",
		positive: []ruleCase{
			{name: "exc_bad_instruction", make: func() *RawCrash {
				return &RawCrash{Exception: Exception{Type: "EXC_BAD_INSTRUCTION", Codes: "0x1, 0x0"}}
			}},
		},
		negative: []ruleCase{
			{name: "exc_bad_access", make: func() *RawCrash {
				return &RawCrash{Exception: Exception{Type: "EXC_BAD_ACCESS", Subtype: "KERN_INVALID_ADDRESS"}}
			}},
		},
	},
	{
		ruleID: "R-exc-guard-01",
		positive: []ruleCase{
			{name: "exc_guard_fd", make: func() *RawCrash {
				return &RawCrash{Exception: Exception{Type: "EXC_GUARD", Codes: "0x...", Subtype: "GUARD_TYPE_FD"}}
			}},
		},
		negative: []ruleCase{
			{name: "exc_crash", make: func() *RawCrash {
				return &RawCrash{Exception: Exception{Type: "EXC_CRASH"}}
			}},
		},
	},
	{
		ruleID: "R-objc-exc-01",
		positive: []ruleCase{
			{name: "exc_crash_with_objc_throw", make: func() *RawCrash {
				return &RawCrash{
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
			}},
		},
		negative: []ruleCase{
			{name: "exc_crash_no_objc_throw", make: func() *RawCrash {
				return &RawCrash{
					Exception: Exception{Type: "EXC_CRASH", Codes: "0x0", Signal: "SIGABRT"},
					Threads: []Thread{{
						Index: 0, Triggered: true,
						Frames: []Frame{
							{Index: 0, Image: "libsystem_kernel", Symbol: "__pthread_kill"},
							{Index: 1, Image: "libsystem_c", Symbol: "abort"},
						},
					}},
				}
			}},
		},
	},
	{
		ruleID: "R-mtc-01",
		positive: []ruleCase{
			{
				name: "mtc_dylib_frame", wantTag: "main_thread_checker_violation",
				make: func() *RawCrash {
					return &RawCrash{
						Exception: Exception{Type: "EXC_CRASH", Signal: "SIGABRT"},
						Threads: []Thread{{
							Index: 0, Triggered: true,
							Frames: []Frame{
								{Index: 0, Image: "main_thread_checker.dylib", Symbol: "main_thread_checker_violation_reporter"},
								{Index: 1, Image: "UIKit", Symbol: "-[UILabel setText:]"},
							},
						}},
					}
				},
			},
		},
		negative: []ruleCase{
			{name: "abort_without_mtc", make: func() *RawCrash {
				return &RawCrash{
					Exception: Exception{Type: "EXC_CRASH", Signal: "SIGABRT"},
					Threads: []Thread{{
						Index: 0, Triggered: true,
						Frames: []Frame{
							{Index: 0, Image: "libsystem_kernel", Symbol: "__pthread_kill"},
							{Index: 1, Image: "libsystem_c", Symbol: "abort"},
						},
					}},
				}
			}},
		},
	},
	{
		ruleID: "R-abort-01",
		positive: []ruleCase{
			{name: "sigabrt_with_abort_frame", make: func() *RawCrash {
				return &RawCrash{
					Exception: Exception{Type: "EXC_CRASH", Signal: "SIGABRT"},
					Threads: []Thread{{
						Index: 0, Triggered: true,
						Frames: []Frame{
							{Index: 0, Image: "libsystem_kernel", Symbol: "__pthread_kill"},
							{Index: 1, Image: "libsystem_platform", Symbol: "_sigtramp"},
							{Index: 2, Image: "libsystem_c", Symbol: "__abort_with_payload"},
							{Index: 3, Image: "MyApp", Symbol: "assertion_failed"},
						},
					}},
				}
			}},
		},
		negative: []ruleCase{
			// SIGABRT with objc_exception_throw anywhere — R-objc-exc-01 owns.
			{name: "objc_throw_present", make: func() *RawCrash {
				return &RawCrash{
					Exception: Exception{Type: "EXC_CRASH", Signal: "SIGABRT"},
					Threads: []Thread{{
						Index: 0, Triggered: true,
						Frames: []Frame{
							{Index: 0, Image: "libsystem_kernel", Symbol: "__pthread_kill"},
							{Index: 1, Image: "libobjc.A.dylib", Symbol: "objc_exception_throw"},
							{Index: 2, Image: "libsystem_c", Symbol: "abort"},
						},
					}},
				}
			}},
		},
	},
	{
		ruleID: "R-watchdog-01",
		positive: []ruleCase{
			{name: "frontboard_8badf00d", make: func() *RawCrash {
				return &RawCrash{Termination: Termination{Namespace: "FRONTBOARD", Code: "0x8badf00d"}}
			}},
		},
		negative: []ruleCase{
			// Right code, wrong namespace — watchdog is board-daemon specific.
			{name: "signal_namespace", make: func() *RawCrash {
				return &RawCrash{Termination: Termination{Namespace: "SIGNAL", Code: "0x8BADF00D"}}
			}},
		},
	},
	{
		ruleID: "R-user-quit-01",
		positive: []ruleCase{
			{name: "frontboard_deadfa11", make: func() *RawCrash {
				return &RawCrash{Termination: Termination{Namespace: "FRONTBOARD", Code: "0xDEADFA11"}}
			}},
		},
		negative: []ruleCase{
			{name: "springboard_deadfa11", make: func() *RawCrash {
				return &RawCrash{Termination: Termination{Namespace: "SPRINGBOARD", Code: "0xDEADFA11"}}
			}},
		},
	},
	{
		ruleID: "R-bg-expired-01",
		positive: []ruleCase{
			{name: "baadca11", make: func() *RawCrash {
				return &RawCrash{Termination: Termination{Namespace: "FRONTBOARD", Code: "0xBAADCA11"}}
			}},
		},
		negative: []ruleCase{
			{name: "watchdog_code", make: func() *RawCrash {
				return &RawCrash{Termination: Termination{Namespace: "FRONTBOARD", Code: "0x8BADF00D"}}
			}},
		},
	},
	{
		ruleID: "R-data-prot-01",
		positive: []ruleCase{
			// Apple renders this code inconsistently; match is case-insensitive.
			{name: "lowercase", make: func() *RawCrash {
				return &RawCrash{Termination: Termination{Namespace: "RUNNINGBOARD", Code: "0xdead10cc"}}
			}},
			{name: "uppercase", make: func() *RawCrash {
				return &RawCrash{Termination: Termination{Namespace: "RUNNINGBOARD", Code: "0xDEAD10CC"}}
			}},
		},
		negative: []ruleCase{
			{name: "transposed_hex", make: func() *RawCrash {
				return &RawCrash{Termination: Termination{Namespace: "RUNNINGBOARD", Code: "0xdead10c0"}}
			}},
		},
	},
	{
		ruleID: "R-code-sign-01",
		positive: []ruleCase{
			// Low nibble distinguishes subcauses but they all route to the same tag.
			{name: "low_0", make: func() *RawCrash {
				return &RawCrash{Termination: Termination{Namespace: "CODESIGNING", Code: "0xc51bad00"}}
			}},
			{name: "low_1", make: func() *RawCrash {
				return &RawCrash{Termination: Termination{Namespace: "CODESIGNING", Code: "0xc51bad01"}}
			}},
			{name: "low_f", make: func() *RawCrash {
				return &RawCrash{Termination: Termination{Namespace: "CODESIGNING", Code: "0xc51bad0f"}}
			}},
			{name: "mixed_case", make: func() *RawCrash {
				return &RawCrash{Termination: Termination{Namespace: "CODESIGNING", Code: "0xC51BAD03"}}
			}},
		},
		negative: []ruleCase{
			// Two-digit low byte (not in /^0xc51bad0[0-9a-f]$/i).
			{name: "two_digit_low_byte", make: func() *RawCrash {
				return &RawCrash{Termination: Termination{Namespace: "CODESIGNING", Code: "0xc51bad10"}}
			}},
		},
	},
	{
		ruleID: "R-jetsam-01",
		positive: []ruleCase{
			{name: "exc_resource_memory", make: func() *RawCrash {
				return &RawCrash{Exception: Exception{Type: "EXC_RESOURCE", Subtype: "MEMORY (fatal)"}}
			}},
			{name: "termination_reason_per_process_limit", make: func() *RawCrash {
				reason := "per-process-limit"
				return &RawCrash{
					Exception:   Exception{Type: "EXC_BREAKPOINT"},
					Termination: Termination{Namespace: "JETSAM", Code: "0x1", Reason: &reason},
				}
			}},
		},
		negative: []ruleCase{
			// CPU subtype belongs to R-cpu-fatal-01 (if FATAL) or unclassified.
			{name: "cpu_subtype", make: func() *RawCrash {
				return &RawCrash{Exception: Exception{Type: "EXC_RESOURCE", Subtype: "CPU (fatal)"}}
			}},
		},
	},
	{
		ruleID: "R-cpu-fatal-01",
		positive: []ruleCase{
			{name: "cpu_fatal", make: func() *RawCrash {
				return &RawCrash{Exception: Exception{Type: "EXC_RESOURCE", Subtype: "CPU FATAL"}}
			}},
			{name: "wakeups_fatal", make: func() *RawCrash {
				return &RawCrash{Exception: Exception{Type: "EXC_RESOURCE", Subtype: "WAKEUPS FATAL"}}
			}},
		},
		negative: []ruleCase{
			// Non-FATAL EXC_RESOURCE falls through to unclassified (the crash
			// subcommand will reject at a higher level in Phase 7).
			{name: "cpu_warning", make: func() *RawCrash {
				return &RawCrash{Exception: Exception{Type: "EXC_RESOURCE", Subtype: "CPU (WARNING)"}}
			}},
			// Regression: a naive strings.Contains(sub,"FATAL") would match
			// "NON-FATAL". R-cpu-fatal-01 must exclude this spelling.
			{name: "cpu_non_fatal_spelling", make: func() *RawCrash {
				return &RawCrash{Exception: Exception{Type: "EXC_RESOURCE", Subtype: "CPU (NON-FATAL)"}}
			}},
		},
	},
	{
		ruleID: "R-swiftui-loop-01",
		positive: []ruleCase{
			{name: "110_consecutive_AG_frames", wantConfidence: "low", make: func() *RawCrash {
				frames := make([]Frame, 110)
				for i := range frames {
					frames[i] = Frame{Index: i, Image: "SwiftUI", Symbol: "AG::Graph::update_someVariant"}
				}
				return &RawCrash{
					Exception: Exception{Type: "EXC_RESOURCE", Subtype: "CPU (WARNING)"},
					Threads:   []Thread{{Index: 0, Triggered: true, Frames: frames}},
				}
			}},
		},
		negative: []ruleCase{
			// 99 frames is exactly below threshold ≥100.
			{name: "just_below_threshold", make: func() *RawCrash {
				frames := make([]Frame, 99)
				for i := range frames {
					frames[i] = Frame{Index: i, Image: "SwiftUI", Symbol: "AG::Graph::update_foo"}
				}
				return &RawCrash{
					Exception: Exception{Type: "EXC_RESOURCE", Subtype: "CPU (WARNING)"},
					Threads:   []Thread{{Index: 0, Triggered: true, Frames: frames}},
				}
			}},
			// Plan requires consecutive frames from the top — a foreign frame
			// at index 1 breaks the run and prevents the rule from firing.
			{name: "broken_run", make: func() *RawCrash {
				frames := make([]Frame, 0, 110)
				frames = append(frames,
					Frame{Index: 0, Image: "SwiftUI", Symbol: "AG::Graph::update_first"},
					Frame{Index: 1, Image: "MyApp", Symbol: "somethingElse"},
				)
				for i := 2; i < 110; i++ {
					frames = append(frames, Frame{Index: i, Image: "SwiftUI", Symbol: "AG::Graph::update_rest"})
				}
				return &RawCrash{
					Exception: Exception{Type: "EXC_RESOURCE", Subtype: "CPU (WARNING)"},
					Threads:   []Thread{{Index: 0, Triggered: true, Frames: frames}},
				}
			}},
		},
	},
}

// TestCategorize_Rules runs every fixture as a subtest and enforces, as a
// side-effect-free invariant, that every rule in `rules` has both positive
// and negative fixtures registered. This replaces the earlier hand-maintained
// coverage map that passed even when actual test functions were missing.
func TestCategorize_Rules(t *testing.T) {
	ruleIDs := map[string]bool{}
	for _, r := range rules {
		ruleIDs[r.ID] = true
	}
	seenPos := map[string]bool{}
	seenNeg := map[string]bool{}

	for _, rt := range ruleFixtures {
		if !ruleIDs[rt.ruleID] {
			t.Errorf("ruleFixtures references unknown rule %q", rt.ruleID)
			continue
		}
		if len(rt.positive) > 0 {
			seenPos[rt.ruleID] = true
		}
		if len(rt.negative) > 0 {
			seenNeg[rt.ruleID] = true
		}

		for _, p := range rt.positive {
			t.Run(rt.ruleID+"/pos/"+p.name, func(t *testing.T) {
				res := Categorize(p.make())
				if res.RuleID != rt.ruleID {
					t.Errorf("rule_id = %q, want %q (tag=%q, reason=%q)",
						res.RuleID, rt.ruleID, res.Tag, res.Reason)
				}
				if p.wantTag != "" && res.Tag != p.wantTag {
					t.Errorf("tag = %q, want %q", res.Tag, p.wantTag)
				}
				if p.wantConfidence != "" && res.Confidence != p.wantConfidence {
					t.Errorf("confidence = %q, want %q", res.Confidence, p.wantConfidence)
				}
			})
		}
		for _, n := range rt.negative {
			t.Run(rt.ruleID+"/neg/"+n.name, func(t *testing.T) {
				res := Categorize(n.make())
				if res.RuleID == rt.ruleID {
					t.Errorf("must not fire %q; got tag=%q reason=%q",
						rt.ruleID, res.Tag, res.Reason)
				}
			})
		}
	}

	t.Run("_coverage", func(t *testing.T) {
		for _, r := range rules {
			if !seenPos[r.ID] {
				t.Errorf("rule %q: no positive fixtures in ruleFixtures", r.ID)
			}
			if !seenNeg[r.ID] {
				t.Errorf("rule %q: no negative fixtures in ruleFixtures", r.ID)
			}
		}
	})
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
