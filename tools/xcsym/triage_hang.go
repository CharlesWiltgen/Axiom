package main

import "strings"

const hangTopFrameWindow = 20

// runLoopParkSymbols are the main-thread top-frame signatures of a thread that
// is merely parked in its run loop (idle). NOTE: __psynch_* is deliberately
// absent — psynch indicates lock contention, i.e. a real block, not a park.
var runLoopParkSymbols = []string{
	"mach_msg2_trap", "mach_msg_trap", "mach_msg",
	"CFRunLoopRun", "CFRunLoopRunSpecific", "__CFRunLoopServiceMachPort",
}

// blockingSyscallSymbols, if present anywhere in the top window, mean the main
// thread is actually blocked (not idle) — a real ANR. These are substring-
// matched, so entries must not collide with benign frames. NB: bare "read"/
// "write" are deliberately EXCLUDED — "read" is a substring of "thread"
// (thread_start, _pthread_wqthread, _dispatch_worker_thread_*), which appears
// in nearly every stack and would defeat idle detection. Use the
// libsystem_kernel stub forms instead.
var blockingSyscallSymbols = []string{
	"__psynch_mutexwait", "__psynch_cvwait", "psynch_",
	"__read", "__write", "pread", "pwrite", "fcntl", "flock",
	"sqlite3_step", "sqlite3_exec",
}

func mainThread(c *RawCrash) *Thread {
	for i := range c.Threads {
		if c.Threads[i].Index == 0 {
			return &c.Threads[i]
		}
	}
	return nil
}

func topSymbolMatches(t *Thread, subs []string) bool {
	if t == nil || len(t.Frames) == 0 {
		return false
	}
	top := t.Frames[0].Symbol
	for _, s := range subs {
		if strings.Contains(top, s) {
			return true
		}
	}
	return false
}

func windowHasSymbol(t *Thread, subs []string, n int) bool {
	if t == nil {
		return false
	}
	limit := len(t.Frames)
	if n < limit {
		limit = n
	}
	for i := 0; i < limit; i++ {
		for _, s := range subs {
			if strings.Contains(t.Frames[i].Symbol, s) {
				return true
			}
		}
	}
	return false
}

func windowHasInAppFrame(t *Thread, n int) bool {
	if t == nil {
		return false
	}
	limit := len(t.Frames)
	if n < limit {
		limit = n
	}
	for i := 0; i < limit; i++ {
		if t.Frames[i].InApp {
			return true
		}
	}
	return false
}

// isIdleRunloop is the shared predicate used by both the hang classifier and
// noise.anr_suspension.v1: top frame is a run-loop park signature AND no app
// frame AND no blocking syscall in the top window.
func isIdleRunloop(c *RawCrash) bool {
	m := mainThread(c)
	if !topSymbolMatches(m, runLoopParkSymbols) {
		return false
	}
	if windowHasInAppFrame(m, hangTopFrameWindow) {
		return false
	}
	if windowHasSymbol(m, blockingSyscallSymbols, hangTopFrameWindow) {
		return false
	}
	return true
}

var hangRules = []Rule{
	{
		ID: "H-idle-runloop-01", Tag: "anr_idle_runloop", Confidence: "high",
		Match: func(c *RawCrash) (bool, string) {
			if isIdleRunloop(c) {
				return true, "main thread parked in run loop (no app frame, no blocking syscall in top 20)"
			}
			return false, ""
		},
	},
	{
		ID: "H-main-block-01", Tag: "anr_main_thread_block", Confidence: "high",
		Match: func(c *RawCrash) (bool, string) {
			m := mainThread(c)
			if m == nil {
				return false, ""
			}
			if windowHasSymbol(m, blockingSyscallSymbols, hangTopFrameWindow) {
				return true, "main thread holds a blocking syscall in the top 20 frames"
			}
			if windowHasInAppFrame(m, hangTopFrameWindow) {
				return true, "main thread runs app code near the top of the stack"
			}
			return false, ""
		},
	},
}

// categorizeHang runs the hang rule list (first match wins); on no match it
// returns a real-block default so an unknown hang is never silently treated as
// idle noise.
func categorizeHang(c *RawCrash) CategorizeResult {
	for _, r := range hangRules {
		if ok, reason := r.Match(c); ok {
			return CategorizeResult{Tag: r.Tag, Confidence: r.Confidence, RuleID: r.ID, Reason: reason}
		}
	}
	return CategorizeResult{Tag: "anr_main_thread_block", Confidence: "low", RuleID: "",
		Reason: "hang did not match an idle-runloop signature; treated as a real block by default"}
}
