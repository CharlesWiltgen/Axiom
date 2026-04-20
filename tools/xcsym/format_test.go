package main

import (
	"encoding/json"
	"strings"
	"testing"
)

// buildStdFixture returns a representative parsed crash used across all
// tier tests. Keeping it in one place means a regression in either the
// .ips parser or the fixture file shows up as a single broken setup line
// rather than N separate tier-test failures.
func buildStdFixture(t *testing.T) (*RawCrash, CategorizeResult, ImageStatus, Environment, InputInfo) {
	t.Helper()
	raw, err := ParseIPS(readFixture(t, "crashes/ips_v2/swift_forced_unwrap.ips"))
	if err != nil {
		t.Fatalf("parse fixture: %v", err)
	}
	cat := Categorize(raw)
	images := ImageStatus{
		Matched: []ImageMatch{
			{UUID: "AABBCCDD-EEFF-0011-2233-445566778899", Name: "MyApp",
				Arch: "arm64", DsymPath: "/dsyms/MyApp.dSYM"},
		},
		Mismatched: []ImageMatch{},
		Missing:    []ImageMiss{},
	}
	env := Environment{
		AtosVersion:          "/Applications/Xcode.app/Contents/Developer/usr/bin/atos",
		CLTVersion:           "Xcode 16.0 Build version 16A5171r",
		CLTVersionShort:      "Xcode 16.0",
		SwiftDemangleVersion: "/Applications/Xcode.app/Contents/Developer/usr/bin/swift-demangle",
		HostArch:             "arm64",
		XcodePath:            "/Applications/Xcode.app/Contents/Developer",
	}
	input := InputInfo{Path: "testdata/crashes/ips_v2/swift_forced_unwrap.ips", Format: FormatIPSv2}
	return raw, cat, images, env, input
}

func TestFormat_Standard_BasicShape(t *testing.T) {
	raw, cat, images, env, input := buildStdFixture(t)
	report, err := Format(raw, images, env, input, cat, TierStandard)
	if err != nil {
		t.Fatalf("Format: %v", err)
	}
	if report.Format != TierStandard {
		t.Errorf("format = %q, want standard", report.Format)
	}
	if report.Images == nil {
		t.Fatal("standard tier: Images should be populated")
	}
	if report.ImagesSummary != nil {
		t.Error("standard tier: ImagesSummary must be nil")
	}
	if report.Crash.PatternRuleID != "R-swift-unwrap-01" {
		t.Errorf("pattern_rule_id = %q, want R-swift-unwrap-01", report.Crash.PatternRuleID)
	}
	if len(report.Crash.CrashedThread.Frames) != 2 {
		t.Errorf("crashed thread frames = %d, want 2 (full)", len(report.Crash.CrashedThread.Frames))
	}
	// Other threads: fixture has thread 1 with MyApp frames... actually thread 1
	// has libdispatch.dylib, which isn't matched. Top-frame collector should
	// skip it. So we expect 0 other-thread top frames.
	if len(report.Crash.OtherThreadsTopFrames) != 0 {
		t.Errorf("other_threads_top_frames = %v, want 0 (system-only frames skipped)",
			report.Crash.OtherThreadsTopFrames)
	}
	if report.Crash.AllThreads != nil {
		t.Error("standard tier: AllThreads must be nil (only in full tier)")
	}
	// Full environment should be present.
	if report.Environment.XcodePath == "" {
		t.Error("standard tier: environment should include XcodePath")
	}
}

func TestFormat_Standard_SizeBudget(t *testing.T) {
	raw, cat, images, env, input := buildStdFixture(t)
	report, err := Format(raw, images, env, input, cat, TierStandard)
	if err != nil {
		t.Fatalf("Format: %v", err)
	}
	buf, err := json.Marshal(report)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	const budget = 12 * 1024
	if len(buf) > budget {
		t.Errorf("standard tier size = %d bytes, exceeds %d-byte budget", len(buf), budget)
	}
}

func TestFormat_Standard_AppFrameDetection(t *testing.T) {
	// A multi-thread crash where non-crashed threads have both app and
	// system frames. Only the matched image's frames should surface.
	raw := &RawCrash{
		App:     AppInfo{Name: "MyApp"},
		Arch:    "arm64",
		Threads: []Thread{
			{Index: 0, Triggered: true, Frames: []Frame{
				{Index: 0, Image: "MyApp", Symbol: "boom"},
			}},
			// Thread 1: mix of MyApp + system frames. Only MyApp frames go in top.
			{Index: 1, Frames: []Frame{
				{Index: 0, Image: "libsystem_kernel", Symbol: "mach_msg_trap"},
				{Index: 1, Image: "MyApp", Symbol: "backgroundWork"},
				{Index: 2, Image: "libdispatch.dylib", Symbol: "_dispatch_worker"},
				{Index: 3, Image: "MyApp", Symbol: "continuation"},
			}},
		},
		UsedImages: []UsedImage{
			{UUID: "AAAA", Name: "MyApp", Arch: "arm64"},
		},
		CrashedIdx: 0,
	}
	images := ImageStatus{
		Matched: []ImageMatch{{UUID: "AAAA", Name: "MyApp", DsymPath: "/MyApp.dSYM"}},
	}
	env := Environment{}
	cat := CategorizeResult{}
	rep, err := Format(raw, images, env, InputInfo{}, cat, TierStandard)
	if err != nil {
		t.Fatalf("Format: %v", err)
	}
	if len(rep.Crash.OtherThreadsTopFrames) != 1 {
		t.Fatalf("other_threads = %d, want 1 (thread 1 with MyApp frames)",
			len(rep.Crash.OtherThreadsTopFrames))
	}
	top := rep.Crash.OtherThreadsTopFrames[0]
	if top.Index != 1 {
		t.Errorf("thread index = %d, want 1", top.Index)
	}
	if len(top.Frames) != 2 {
		t.Errorf("app frames on thread 1 = %d, want 2 (MyApp only)", len(top.Frames))
	}
	for _, f := range top.Frames {
		if f.Image != "MyApp" {
			t.Errorf("frame image = %q, want MyApp (system frames must be filtered)", f.Image)
		}
	}
}

func TestFormat_Standard_OtherThreadsBudget(t *testing.T) {
	// 3 non-crashed threads each with 15 MyApp frames = 45 candidates.
	// Budget is 20 — collect 15 from thread 1, 5 from thread 2, none from 3.
	appFrames := func(n int) []Frame {
		out := make([]Frame, n)
		for i := range out {
			out[i] = Frame{Index: i, Image: "MyApp", Symbol: "foo"}
		}
		return out
	}
	raw := &RawCrash{
		App:  AppInfo{Name: "MyApp"},
		Arch: "arm64",
		Threads: []Thread{
			{Index: 0, Triggered: true, Frames: appFrames(1)},
			{Index: 1, Frames: appFrames(15)},
			{Index: 2, Frames: appFrames(15)},
			{Index: 3, Frames: appFrames(15)},
		},
		UsedImages: []UsedImage{{UUID: "AAAA", Name: "MyApp"}},
		CrashedIdx: 0,
	}
	images := ImageStatus{Matched: []ImageMatch{{UUID: "AAAA", Name: "MyApp"}}}
	rep, err := Format(raw, images, Environment{}, InputInfo{}, CategorizeResult{}, TierStandard)
	if err != nil {
		t.Fatalf("Format: %v", err)
	}
	var total int
	for _, t := range rep.Crash.OtherThreadsTopFrames {
		total += len(t.Frames)
	}
	if total != standardOtherThreadsBudget {
		t.Errorf("total top frames across other threads = %d, want %d",
			total, standardOtherThreadsBudget)
	}
	if len(rep.Crash.OtherThreadsTopFrames) != 2 {
		t.Errorf("threads represented = %d, want 2 (thread 3 didn't fit in budget)",
			len(rep.Crash.OtherThreadsTopFrames))
	}
}

func TestFormat_RejectsUnknownTier(t *testing.T) {
	_, err := Format(&RawCrash{}, ImageStatus{}, Environment{}, InputInfo{}, CategorizeResult{}, "gigantic")
	if err == nil {
		t.Error("expected error for unknown tier")
	}
	if !strings.Contains(err.Error(), "gigantic") {
		t.Errorf("error should mention the bad tier value: %v", err)
	}
}
