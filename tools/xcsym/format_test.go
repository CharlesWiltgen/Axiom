package main

import (
	"encoding/json"
	"fmt"
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

func TestFormat_Summary_BasicShape(t *testing.T) {
	raw, cat, images, env, input := buildStdFixture(t)
	rep, err := Format(raw, images, env, input, cat, TierSummary)
	if err != nil {
		t.Fatalf("Format: %v", err)
	}
	if rep.Format != TierSummary {
		t.Errorf("format = %q, want summary", rep.Format)
	}
	// ImagesSummary present, Images absent.
	if rep.Images != nil {
		t.Error("summary tier: Images must be nil")
	}
	if rep.ImagesSummary == nil {
		t.Fatal("summary tier: ImagesSummary must be populated")
	}
	if rep.ImagesSummary.MatchedCount != 1 {
		t.Errorf("matched_count = %d, want 1", rep.ImagesSummary.MatchedCount)
	}
	// Environment stripped to CLTVersionShort only.
	if rep.Environment.CLTVersionShort != "Xcode 16.0" {
		t.Errorf("clt_version_short = %q, want Xcode 16.0", rep.Environment.CLTVersionShort)
	}
	if rep.Environment.XcodePath != "" || rep.Environment.AtosVersion != "" {
		t.Errorf("summary tier environment should be stripped, got %+v", rep.Environment)
	}
	// Crashed thread: frames capped at summaryCrashedFrames (5).
	// Our fixture only has 2 frames so cap isn't triggered — verified
	// separately below.
	if len(rep.Crash.CrashedThread.Frames) != 2 {
		t.Errorf("crashed frames (fixture) = %d, want 2", len(rep.Crash.CrashedThread.Frames))
	}
	// No other-threads, no all_threads on summary.
	if len(rep.Crash.OtherThreadsTopFrames) != 0 {
		t.Errorf("summary tier: other_threads_top_frames must be empty, got %d", len(rep.Crash.OtherThreadsTopFrames))
	}
	if rep.Crash.AllThreads != nil {
		t.Error("summary tier: all_threads must be nil")
	}
	if rep.Crash.PatternRuleID != "R-swift-unwrap-01" {
		t.Errorf("pattern_rule_id = %q, want R-swift-unwrap-01", rep.Crash.PatternRuleID)
	}
}

func TestFormat_Summary_CrashedThreadFrameCap(t *testing.T) {
	// Build a crashed thread with 20 frames. Summary must cap at 5.
	frames := make([]Frame, 20)
	for i := range frames {
		frames[i] = Frame{Index: i, Image: "MyApp", Symbol: "frame"}
	}
	raw := &RawCrash{
		Threads:    []Thread{{Index: 0, Triggered: true, Frames: frames}},
		UsedImages: []UsedImage{{UUID: "AAAA", Name: "MyApp"}},
		CrashedIdx: 0,
	}
	rep, err := Format(raw, ImageStatus{}, Environment{}, InputInfo{}, CategorizeResult{}, TierSummary)
	if err != nil {
		t.Fatalf("Format: %v", err)
	}
	if len(rep.Crash.CrashedThread.Frames) != summaryCrashedFrames {
		t.Errorf("summary crashed frames = %d, want %d",
			len(rep.Crash.CrashedThread.Frames), summaryCrashedFrames)
	}
}

func TestFormat_Summary_SizeBudget(t *testing.T) {
	raw, cat, images, env, input := buildStdFixture(t)
	rep, err := Format(raw, images, env, input, cat, TierSummary)
	if err != nil {
		t.Fatalf("Format: %v", err)
	}
	buf, err := json.Marshal(rep)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	const budget = 2 * 1024
	if len(buf) > budget {
		t.Errorf("summary size = %d bytes, exceeds %d-byte budget:\n%s",
			len(buf), budget, string(buf))
	}
}

func TestFormat_Summary_FallbackCLTShort(t *testing.T) {
	// When CLTVersionShort is empty, summary falls back to the full
	// CLTVersion string. Lets callers skip computing a shorthand if
	// they don't have one handy.
	env := Environment{CLTVersion: "Xcode 16.0 Build version 16A5171r"}
	rep, err := Format(&RawCrash{}, ImageStatus{}, env, InputInfo{}, CategorizeResult{}, TierSummary)
	if err != nil {
		t.Fatalf("Format: %v", err)
	}
	if rep.Environment.CLTVersionShort != env.CLTVersion {
		t.Errorf("fallback CLTVersionShort = %q, want %q",
			rep.Environment.CLTVersionShort, env.CLTVersion)
	}
}

func TestFormat_Full_AllThreadsPopulated(t *testing.T) {
	raw, cat, images, env, input := buildStdFixture(t)
	rep, err := Format(raw, images, env, input, cat, TierFull)
	if err != nil {
		t.Fatalf("Format: %v", err)
	}
	if rep.Format != TierFull {
		t.Errorf("format = %q, want full", rep.Format)
	}
	if rep.Images == nil {
		t.Fatal("full tier: Images must be populated")
	}
	// Fixture has 2 threads; full tier surfaces both in AllThreads.
	if len(rep.Crash.AllThreads) != 2 {
		t.Errorf("AllThreads = %d, want 2 (full tier)", len(rep.Crash.AllThreads))
	}
	// axiom-uya: full tier must NOT populate OtherThreadsTopFrames — AllThreads
	// already contains everything it would carry, so including it was pure
	// duplication that inflated payload size.
	if len(rep.Crash.OtherThreadsTopFrames) != 0 {
		t.Errorf("full tier OtherThreadsTopFrames = %d, want 0 (AllThreads is the superset)",
			len(rep.Crash.OtherThreadsTopFrames))
	}
	if rep.SizeWarning != nil {
		t.Errorf("unexpected SizeWarning on small fixture: %q", *rep.SizeWarning)
	}
}

func TestFormat_Full_SizeWarningFiresPast100KB(t *testing.T) {
	// Build a fixture whose marshaled size deliberately exceeds the 100 KB
	// threshold: thousands of symbolicated frames, each carrying a
	// moderately long symbol string.
	const frameCount = 4000
	frames := make([]Frame, frameCount)
	long := strings.Repeat("MyModuleNamespace.SomeAggregatedType.someInstanceMethod(_:).", 2)
	for i := range frames {
		frames[i] = Frame{
			Index:        i,
			Address:      "0x100000000",
			Image:        "MyApp",
			Symbol:       long,
			Symbolicated: true,
		}
	}
	raw := &RawCrash{
		Threads:    []Thread{{Index: 0, Triggered: true, Frames: frames}},
		UsedImages: []UsedImage{{UUID: "AAAA", Name: "MyApp"}},
		CrashedIdx: 0,
	}
	rep, err := Format(raw, ImageStatus{}, Environment{}, InputInfo{}, CategorizeResult{}, TierFull)
	if err != nil {
		t.Fatalf("Format: %v", err)
	}
	if rep.SizeWarning == nil {
		t.Fatal("expected SizeWarning to fire on oversized full tier report")
	}
	if !strings.Contains(*rep.SizeWarning, "exceeds") {
		t.Errorf("SizeWarning text = %q; expected it to mention 'exceeds'", *rep.SizeWarning)
	}
	// The warning must cite the actual marshaled byte count. Implementation
	// measures size before setting SizeWarning itself (to avoid a chicken-
	// and-egg with the warning text's own length), so the test reproduces
	// that: marshal the report with SizeWarning cleared and assert THAT
	// size appears in the warning text. Guards against a stale stub that
	// might say "0 bytes" or hard-code the threshold.
	copy := rep
	copy.SizeWarning = nil
	buf, err := json.Marshal(copy)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	sizeStr := fmt.Sprintf("%d", len(buf))
	if !strings.Contains(*rep.SizeWarning, sizeStr) {
		t.Errorf("SizeWarning should cite pre-annotation size %s bytes; got %q",
			sizeStr, *rep.SizeWarning)
	}
}

func TestFormat_Full_NoWarningUnder100KB(t *testing.T) {
	raw, cat, images, env, input := buildStdFixture(t)
	rep, err := Format(raw, images, env, input, cat, TierFull)
	if err != nil {
		t.Fatalf("Format: %v", err)
	}
	if rep.SizeWarning != nil {
		t.Errorf("small fixture triggered SizeWarning: %q", *rep.SizeWarning)
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
