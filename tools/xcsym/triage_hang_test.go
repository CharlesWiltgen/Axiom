package main

import "testing"

func hangRaw(frames []Frame) *RawCrash {
	return &RawCrash{Kind: "hang", CrashedIdx: 0,
		Threads: []Thread{{Index: 0, Triggered: true, Frames: frames}}}
}

func TestCategorizeHang_IdleRunloop(t *testing.T) {
	raw := hangRaw([]Frame{
		{Image: "libsystem_kernel.dylib", Symbol: "mach_msg2_trap"},
		{Image: "CoreFoundation", Symbol: "CFRunLoopRun"},
	})
	if got := categorizeHang(raw).Tag; got != "anr_idle_runloop" {
		t.Fatalf("tag = %q, want anr_idle_runloop", got)
	}
}

func TestCategorizeHang_RealBlock_BuriedAppFrame(t *testing.T) {
	// DispatchQueue.main.sync deadlock: parked in mach_msg with app frame deep.
	frames := []Frame{
		{Image: "libsystem_kernel.dylib", Symbol: "mach_msg2_trap"},
		{Image: "libdispatch.dylib", Symbol: "_dispatch_sync_f_slow"},
		{Image: "CoreFoundation", Symbol: "x"},
		{Image: "UIKitCore", Symbol: "y"},
		{Image: "MyApp", Symbol: "ViewModel.load()", InApp: true},
	}
	if got := categorizeHang(hangRaw(frames)).Tag; got != "anr_main_thread_block" {
		t.Fatalf("tag = %q, want anr_main_thread_block (buried app frame ⇒ real block)", got)
	}
}

func TestCategorizeHang_RealBlock_SqliteStep(t *testing.T) {
	frames := []Frame{
		{Image: "libsqlite3.dylib", Symbol: "sqlite3_step"},
		{Image: "CoreFoundation", Symbol: "CFRunLoopRun"},
	}
	if got := categorizeHang(hangRaw(frames)).Tag; got != "anr_main_thread_block" {
		t.Fatalf("tag = %q, want anr_main_thread_block (blocking syscall ⇒ real block)", got)
	}
}

func TestCategorizeHang_ThreadFrameNotMistakenForBlock(t *testing.T) {
	raw := hangRaw([]Frame{
		{Image: "libsystem_kernel.dylib", Symbol: "mach_msg2_trap"},
		{Image: "CoreFoundation", Symbol: "CFRunLoopRun"},
		{Image: "libsystem_pthread.dylib", Symbol: "thread_start"},
	})
	if got := categorizeHang(raw).Tag; got != "anr_idle_runloop" {
		t.Fatalf("tag = %q, want anr_idle_runloop (thread_start must not read as a blocking syscall)", got)
	}
}

func TestCategorizeHang_NoMainThreadFallsBackToRealBlock(t *testing.T) {
	raw := &RawCrash{Kind: "hang", CrashedIdx: 0, Threads: []Thread{
		{Index: 7, Triggered: true, Frames: []Frame{{Image: "X", Symbol: "y"}}},
	}}
	res := categorizeHang(raw)
	if res.Tag != "anr_main_thread_block" || res.Confidence != "low" {
		t.Fatalf("got %+v, want anr_main_thread_block/low when no main thread present", res)
	}
}

var hangRuleFixtures = map[string]func() *RawCrash{
	"H-idle-runloop-01": func() *RawCrash {
		return hangRaw([]Frame{
			{Image: "libsystem_kernel.dylib", Symbol: "mach_msg2_trap"},
			{Image: "CoreFoundation", Symbol: "CFRunLoopRun"},
		})
	},
	"H-main-block-01": func() *RawCrash {
		return hangRaw([]Frame{{Image: "libsqlite3.dylib", Symbol: "sqlite3_step"}})
	},
}

func TestHangRules_HaveFixtures(t *testing.T) {
	for _, r := range hangRules {
		mk, ok := hangRuleFixtures[r.ID]
		if !ok {
			t.Errorf("hang rule %q has no positive fixture in hangRuleFixtures", r.ID)
			continue
		}
		if got := categorizeHang(mk()).RuleID; got != r.ID {
			t.Errorf("fixture for %q classified as %q", r.ID, got)
		}
	}
}
