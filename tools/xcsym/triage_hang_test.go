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
