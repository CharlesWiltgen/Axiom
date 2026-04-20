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
	{
		ID: "R-swift-fatal-01", Tag: "swift_fatal_error", Confidence: "high",
		Match: func(c *RawCrash) (bool, string) {
			if c.Exception.Type != "EXC_BREAKPOINT" {
				return false, ""
			}
			if !strings.HasPrefix(c.Exception.Subtype, "Swift runtime failure:") {
				return false, ""
			}
			sentinels := []string{"_assertionFailure", "_fatalError", "_preconditionFailure"}
			if hit := hasAnyCrashedFrameSymbol(c, sentinels, 8); hit != "" {
				return true, "crashed-thread frame matches Swift runtime sentinel " + hit
			}
			return false, ""
		},
	},
}

// hasCrashedFrameSymbol reports whether any of the crashed thread's first n
// frames has a symbol containing sub. If n <= 0 the whole thread is scanned.
// Real Swift runtime crashes commonly bury the informative symbol a few
// frames down from the OS-level trap, so rules scan a small window rather
// than only frame 0.
func hasCrashedFrameSymbol(c *RawCrash, sub string, n int) bool {
	if c.CrashedIdx < 0 || c.CrashedIdx >= len(c.Threads) {
		return false
	}
	frames := c.Threads[c.CrashedIdx].Frames
	limit := len(frames)
	if n > 0 && n < limit {
		limit = n
	}
	for i := 0; i < limit; i++ {
		if strings.Contains(frames[i].Symbol, sub) {
			return true
		}
	}
	return false
}

// hasAnyCrashedFrameSymbol returns the first substring that any of the top n
// crashed-thread frames contains, or "" if none match. Useful for rules that
// accept several sentinel symbols and want to quote the one that fired in
// Reason.
func hasAnyCrashedFrameSymbol(c *RawCrash, subs []string, n int) string {
	for _, sub := range subs {
		if hasCrashedFrameSymbol(c, sub, n) {
			return sub
		}
	}
	return ""
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
