package main

import "strings"

// CategorizeResult is the outcome of running the rule engine against a
// RawCrash. Downstream consumers (crash subcommand, JSON output) populate
// CrashInfo.Pattern* fields from this struct.
type CategorizeResult struct {
	Tag        string
	Confidence string // high | heuristic | low
	RuleID     string
	Reason     string
}

// Rule is a pure predicate over RawCrash. Match returns (true, reason) on a
// hit or (false, "") on a miss. Reason is surfaced in PatternReason so users
// understand *why* a rule fired (e.g. which field matched which substring).
type Rule struct {
	ID         string
	Tag        string
	Confidence string
	Match      func(*RawCrash) (bool, string)
}

// rules are evaluated in order; first match wins. Order by specificity: more
// narrowly-scoped signals (specific subtype substrings, frame signatures) go
// before broad catch-alls. Heuristic/low-confidence rules are slotted ahead
// of high-confidence rules only when their extra signal is more informative
// (e.g. zombie heap corruption vs. plain bad-access).
var rules = []Rule{
	{
		ID: "R-swift-unwrap-01", Tag: "swift_forced_unwrap", Confidence: "high",
		Match: func(c *RawCrash) (bool, string) {
			if c.Exception.Type == "EXC_BREAKPOINT" && strings.Contains(
				c.Exception.Subtype,
				"unexpectedly found nil while unwrapping an Optional value") {
				return true, "exception.subtype matched 'Swift runtime failure: unexpectedly found nil while unwrapping an Optional value'"
			}
			return false, ""
		},
	},
	{
		ID: "R-swift-conc-01", Tag: "swift_concurrency_violation", Confidence: "high",
		Match: func(c *RawCrash) (bool, string) {
			if c.Exception.Type != "EXC_BREAKPOINT" {
				return false, ""
			}
			for _, needle := range []string{
				"_dispatch_assert_queue_fail",
				"_swift_task_isCurrentExecutor",
				"swift_task_reportUnexpectedExecutor",
			} {
				if strings.Contains(c.Exception.Subtype, needle) {
					return true, "exception.subtype contains concurrency sentinel " + needle
				}
			}
			return false, ""
		},
	},
}

// Categorize walks the rule list and returns the first match. On no match it
// returns a synthetic "unclassified" result whose Reason documents which
// fields were inspected — this keeps triage deterministic when no pattern
// fires.
func Categorize(c *RawCrash) CategorizeResult {
	for _, r := range rules {
		if ok, reason := r.Match(c); ok {
			return CategorizeResult{
				Tag:        r.Tag,
				Confidence: r.Confidence,
				RuleID:     r.ID,
				Reason:     reason,
			}
		}
	}
	return CategorizeResult{
		Tag:        "unclassified",
		Confidence: "low",
		RuleID:     "",
		Reason:     buildUnclassifiedReason(c),
	}
}

func buildUnclassifiedReason(c *RawCrash) string {
	return "no rule matched — checked: exception.type=" + c.Exception.Type +
		", termination.namespace=" + c.Termination.Namespace +
		", termination.code=" + c.Termination.Code
}
