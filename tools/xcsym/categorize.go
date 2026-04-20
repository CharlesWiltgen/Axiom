package main

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// hexAddrRE extracts hexadecimal addresses from free-form .ips strings
// (exception.codes, exception.subtype). We use this to correlate faulting
// addresses against thread SP values in R-stack-overflow-01.
var hexAddrRE = regexp.MustCompile(`0x[0-9a-fA-F]+`)

// codeSignKilledRE matches the family of termination codes the kernel emits
// when it kills a process for code-signing/provisioning violations. The low
// nibble distinguishes subcauses but they all route to the same category.
var codeSignKilledRE = regexp.MustCompile(`(?i)^0xc51bad0[0-9a-f]$`)

func extractHexAddresses(s string) []uint64 {
	var out []uint64
	for _, m := range hexAddrRE.FindAllString(s, -1) {
		v, err := strconv.ParseUint(m, 0, 64)
		if err == nil {
			out = append(out, v)
		}
	}
	return out
}

// absDiffU returns |a-b| for uint64 without signed overflow pitfalls.
func absDiffU(a, b uint64) uint64 {
	if a > b {
		return a - b
	}
	return b - a
}

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
	{
		ID: "R-zombie-01", Tag: "zombie_or_heap_corruption", Confidence: "heuristic",
		Match: func(c *RawCrash) (bool, string) {
			if c.Exception.Type != "EXC_BAD_ACCESS" {
				return false, ""
			}
			subs := []string{"libgmalloc", "_NSZombie", "NSZombie"}
			if hit := hasAnyCrashedFrameImage(c, subs, 10); hit != "" {
				return true, "top-10 frames on crashed thread reference image " + hit
			}
			return false, ""
		},
	},
	{
		ID: "R-stack-overflow-01", Tag: "stack_overflow", Confidence: "heuristic",
		Match: func(c *RawCrash) (bool, string) {
			if c.Exception.Type != "EXC_BAD_ACCESS" {
				return false, ""
			}
			// .ips renders KERN_PROTECTION_FAILURE in subtype typically ("at 0x...")
			// but the plan text says codes; check both for robustness.
			blob := c.Exception.Codes + " " + c.Exception.Subtype
			if !strings.Contains(blob, "KERN_PROTECTION_FAILURE") {
				return false, ""
			}
			const guardPage uint64 = 4096
			addrs := extractHexAddresses(blob)
			for _, addr := range addrs {
				for _, t := range c.Threads {
					if t.State == nil || t.State.SP == 0 {
						continue
					}
					if absDiffU(addr, t.State.SP) <= guardPage {
						return true, fmt.Sprintf(
							"guard page pattern: faulting addr 0x%x within %d bytes of thread %d SP 0x%x",
							addr, guardPage, t.Index, t.State.SP)
					}
				}
			}
			return false, ""
		},
	},
	{
		ID: "R-bad-access-01", Tag: "bad_memory_access", Confidence: "high",
		Match: func(c *RawCrash) (bool, string) {
			if c.Exception.Type != "EXC_BAD_ACCESS" {
				return false, ""
			}
			blob := c.Exception.Codes + " " + c.Exception.Subtype
			if !strings.Contains(blob, "KERN_INVALID_ADDRESS") {
				return false, ""
			}
			return true, "EXC_BAD_ACCESS with KERN_INVALID_ADDRESS"
		},
	},
	{
		ID: "R-illegal-inst-01", Tag: "illegal_instruction", Confidence: "high",
		Match: func(c *RawCrash) (bool, string) {
			if c.Exception.Type == "EXC_BAD_INSTRUCTION" {
				return true, "exception.type == EXC_BAD_INSTRUCTION"
			}
			return false, ""
		},
	},
	{
		ID: "R-exc-guard-01", Tag: "exc_guard", Confidence: "high",
		Match: func(c *RawCrash) (bool, string) {
			if c.Exception.Type == "EXC_GUARD" {
				return true, "exception.type == EXC_GUARD"
			}
			return false, ""
		},
	},
	{
		ID: "R-objc-exc-01", Tag: "objc_exception", Confidence: "high",
		Match: func(c *RawCrash) (bool, string) {
			if c.Exception.Type != "EXC_CRASH" {
				return false, ""
			}
			if hit := hasAnyFrameSymbolAllThreads(c, []string{"objc_exception_throw"}); hit != "" {
				return true, "EXC_CRASH with " + hit + " in backtrace"
			}
			return false, ""
		},
	},
	{
		ID: "R-mtc-01", Tag: "main_thread_checker_violation", Confidence: "high",
		Match: func(c *RawCrash) (bool, string) {
			if hit := hasAnyCrashedFrameImage(c, []string{"main_thread_checker.dylib"}, 0); hit != "" {
				return true, "crashed-thread frame references image " + hit
			}
			return false, ""
		},
	},
	{
		ID: "R-abort-01", Tag: "abort", Confidence: "high",
		Match: func(c *RawCrash) (bool, string) {
			if c.Exception.Signal != "SIGABRT" {
				return false, ""
			}
			// Defensive: never fire when an ObjC exception was the proximate
			// cause — R-objc-exc-01 owns that case and ordering usually
			// handles it, but the exclusion is cheap to check here.
			if hasAnyFrameSymbolAllThreads(c, []string{"objc_exception_throw"}) != "" {
				return false, ""
			}
			hit := hasAnyCrashedFrameSymbol(c, []string{"__abort_with_payload", "abort"}, 10)
			if hit != "" {
				return true, "SIGABRT with crashed-thread frame " + hit
			}
			return false, ""
		},
	},
	{
		ID: "R-watchdog-01", Tag: "watchdog_termination", Confidence: "high",
		Match: func(c *RawCrash) (bool, string) {
			if !eqFoldAny(c.Termination.Namespace, "FRONTBOARD", "SPRINGBOARD", "ASSERTIOND") {
				return false, ""
			}
			if !strings.EqualFold(c.Termination.Code, "0x8BADF00D") {
				return false, ""
			}
			return true, "termination.namespace=" + c.Termination.Namespace + " with code 0x8BADF00D (watchdog)"
		},
	},
	{
		ID: "R-user-quit-01", Tag: "user_force_quit", Confidence: "high",
		Match: func(c *RawCrash) (bool, string) {
			if !strings.EqualFold(c.Termination.Namespace, "FRONTBOARD") {
				return false, ""
			}
			if !strings.EqualFold(c.Termination.Code, "0xDEADFA11") {
				return false, ""
			}
			return true, "FRONTBOARD termination 0xDEADFA11 (user force quit)"
		},
	},
	{
		ID: "R-bg-expired-01", Tag: "background_task_expired", Confidence: "high",
		Match: func(c *RawCrash) (bool, string) {
			if strings.EqualFold(c.Termination.Code, "0xBAADCA11") {
				return true, "termination.code 0xBAADCA11 (background task expired)"
			}
			return false, ""
		},
	},
	{
		ID: "R-data-prot-01", Tag: "data_protection_violation", Confidence: "high",
		Match: func(c *RawCrash) (bool, string) {
			if strings.EqualFold(c.Termination.Code, "0xdead10cc") {
				return true, "termination.code 0xdead10cc (data protection violation)"
			}
			return false, ""
		},
	},
	{
		ID: "R-code-sign-01", Tag: "code_signing_killed", Confidence: "high",
		Match: func(c *RawCrash) (bool, string) {
			if codeSignKilledRE.MatchString(c.Termination.Code) {
				return true, "termination.code " + c.Termination.Code + " matches code-signing family 0xc51bad0X"
			}
			return false, ""
		},
	},
	{
		ID: "R-jetsam-01", Tag: "jetsam_oom", Confidence: "high",
		Match: func(c *RawCrash) (bool, string) {
			if c.Exception.Type == "EXC_RESOURCE" && strings.Contains(c.Exception.Subtype, "MEMORY") {
				return true, "EXC_RESOURCE with MEMORY subtype (jetsam / OOM)"
			}
			if c.Termination.Reason != nil {
				reason := *c.Termination.Reason
				for _, needle := range []string{"per-process-limit", "vm-pageshortage"} {
					if strings.Contains(reason, needle) {
						return true, "termination.reason contains jetsam sentinel " + needle
					}
				}
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

// hasAnyCrashedFrameImage checks whether the crashed thread's first n frames
// reference any of the given image-name substrings (case-sensitive match
// against Frame.Image). Returns the first matching substring or "". Mirrors
// hasAnyCrashedFrameSymbol but on Image instead of Symbol.
func hasAnyCrashedFrameImage(c *RawCrash, subs []string, n int) string {
	if c.CrashedIdx < 0 || c.CrashedIdx >= len(c.Threads) {
		return ""
	}
	frames := c.Threads[c.CrashedIdx].Frames
	limit := len(frames)
	if n > 0 && n < limit {
		limit = n
	}
	for i := 0; i < limit; i++ {
		for _, sub := range subs {
			if strings.Contains(frames[i].Image, sub) {
				return sub
			}
		}
	}
	return ""
}

// hasAnyFrameSymbolAllThreads scans every thread's frames for the first
// substring match. Some rules (objc exceptions, MTC) care about the presence
// of the signature anywhere in the backtrace forest, not just on the crashed
// thread.
func hasAnyFrameSymbolAllThreads(c *RawCrash, subs []string) string {
	for _, t := range c.Threads {
		for _, f := range t.Frames {
			for _, sub := range subs {
				if strings.Contains(f.Symbol, sub) {
					return sub
				}
			}
		}
	}
	return ""
}

// hasAnyFrameImageAllThreads is the Image equivalent of
// hasAnyFrameSymbolAllThreads.
func hasAnyFrameImageAllThreads(c *RawCrash, subs []string) string {
	for _, t := range c.Threads {
		for _, f := range t.Frames {
			for _, sub := range subs {
				if strings.Contains(f.Image, sub) {
					return sub
				}
			}
		}
	}
	return ""
}

// eqFoldAny returns true if s case-insensitively equals any of options.
func eqFoldAny(s string, options ...string) bool {
	for _, o := range options {
		if strings.EqualFold(s, o) {
			return true
		}
	}
	return false
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
