package main

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

// readFixture reads a file under testdata/ and aborts the test on error.
// Called from Phase 6 onward — replaces inlined fixture literals with
// checked-in crash files so real format variations can be exercised.
func readFixture(t *testing.T, rel string) []byte {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", rel))
	if err != nil {
		t.Fatalf("read fixture %s: %v", rel, err)
	}
	return data
}

func TestParseIPS_v2_SwiftForcedUnwrap(t *testing.T) {
	raw, err := ParseIPS(readFixture(t, "crashes/ips_v2/swift_forced_unwrap.ips"))
	if err != nil {
		t.Fatalf("ParseIPS: %v", err)
	}
	if raw.Format != FormatIPSv2 {
		t.Errorf("format = %q, want %q", raw.Format, FormatIPSv2)
	}
	if raw.App.Name != "MyApp" || raw.App.BundleID != "com.example.MyApp" || raw.App.Version != "1.0" {
		t.Errorf("app = %+v; want MyApp/com.example.MyApp/1.0", raw.App)
	}
	if raw.Arch != "arm64" {
		t.Errorf("arch = %q, want arm64 (from cpuType ARM-64)", raw.Arch)
	}
	if raw.OS.IsSimulator {
		t.Error("IsSimulator = true on device path; want false")
	}
	if raw.Exception.Type != "EXC_BREAKPOINT" {
		t.Errorf("exception.type = %q", raw.Exception.Type)
	}
	if raw.Exception.Signal != "SIGTRAP" {
		t.Errorf("exception.signal = %q", raw.Exception.Signal)
	}
	// Categorize must fire R-swift-unwrap-01 on this parsed crash.
	res := Categorize(raw)
	if res.RuleID != "R-swift-unwrap-01" {
		t.Errorf("Categorize rule = %q, want R-swift-unwrap-01 (tag=%q, reason=%q)",
			res.RuleID, res.Tag, res.Reason)
	}
	if raw.CrashedIdx != 0 {
		t.Errorf("CrashedIdx = %d, want 0 (faultingThread)", raw.CrashedIdx)
	}
	if len(raw.Threads) != 2 {
		t.Fatalf("threads = %d, want 2", len(raw.Threads))
	}
	if !raw.Threads[0].Triggered {
		t.Error("thread 0 should be triggered")
	}
	if raw.Threads[0].State == nil {
		t.Fatal("thread 0 missing threadState")
	}
	if raw.Threads[0].State.SP != 6167707648 {
		t.Errorf("thread 0 SP = 0x%x, want 0x16f1fc000", raw.Threads[0].State.SP)
	}
	if len(raw.Threads[0].Frames) != 2 {
		t.Fatalf("thread 0 frames = %d, want 2", len(raw.Threads[0].Frames))
	}
	// Frame 0: imageIndex=0 → Image="MyApp"
	f0 := raw.Threads[0].Frames[0]
	if f0.Image != "MyApp" {
		t.Errorf("thread0 frame0.Image = %q, want MyApp", f0.Image)
	}
	if f0.Symbol != "ContentView.body.getter" {
		t.Errorf("thread0 frame0.Symbol = %q", f0.Symbol)
	}
	// Thread 1 references imageIndex=1 → "libdispatch.dylib"
	if raw.Threads[1].Frames[0].Image != "libdispatch.dylib" {
		t.Errorf("thread1 frame0.Image = %q, want libdispatch.dylib", raw.Threads[1].Frames[0].Image)
	}
	if len(raw.UsedImages) != 2 {
		t.Fatalf("usedImages = %d, want 2", len(raw.UsedImages))
	}
	if raw.UsedImages[0].UUID != "AABBCCDD-EEFF-0011-2233-445566778899" {
		t.Errorf("usedImages[0].UUID = %q, want uppercase dashed", raw.UsedImages[0].UUID)
	}
	if raw.UsedImages[0].LoadAddress != 4294967296 {
		t.Errorf("usedImages[0].LoadAddress = %d, want 4294967296", raw.UsedImages[0].LoadAddress)
	}
	// Frame.UUID is plumbed from the payload's usedImages[imageIndex].uuid so
	// the symbolicate pipeline can group by UUID instead of name (two images
	// can share a name; UUIDs are globally unique).
	if raw.Threads[0].Frames[0].UUID != "AABBCCDD-EEFF-0011-2233-445566778899" {
		t.Errorf("thread0 frame0.UUID = %q, want MyApp UUID (from imageIndex=0)",
			raw.Threads[0].Frames[0].UUID)
	}
	if raw.Threads[1].Frames[0].UUID != "11223344-5566-7788-99AA-BBCCDDEEFF00" {
		t.Errorf("thread1 frame0.UUID = %q, want libdispatch UUID (from imageIndex=1)",
			raw.Threads[1].Frames[0].UUID)
	}
}

func TestParseIPS_v1_SwiftForcedUnwrap(t *testing.T) {
	raw, err := ParseIPS(readFixture(t, "crashes/ips_v1/swift_forced_unwrap.ips"))
	if err != nil {
		t.Fatalf("ParseIPS: %v", err)
	}
	if raw.Format != FormatIPSv1 {
		t.Errorf("format = %q, want %q", raw.Format, FormatIPSv1)
	}
	if raw.App.BundleID != "com.example.MyApp" {
		t.Errorf("bundle_id = %q (v1 uses snake_case)", raw.App.BundleID)
	}
	if raw.Arch != "arm64" {
		t.Errorf("arch = %q, want arm64", raw.Arch)
	}
	if Categorize(raw).RuleID != "R-swift-unwrap-01" {
		t.Errorf("v1 should categorize the same as v2")
	}
}

func TestParseIPS_HangDetected(t *testing.T) {
	data := readFixture(t, "crashes/ips_v2/hang.ips")
	_, err := ParseIPS(data)
	if err == nil {
		t.Fatal("expected HangError for bug_type=298 hang report")
	}
	var he *HangError
	if !errors.As(err, &he) {
		t.Fatalf("expected *HangError, got %T: %v", err, err)
	}
	if he.BugType != "298" {
		t.Errorf("HangError.BugType = %q, want 298", he.BugType)
	}
}

func TestParseIPS_SimulatorDetection(t *testing.T) {
	// Minimal v2 file whose procPath embeds /CoreSimulator/ — Apple's canonical
	// marker that a crash came from the iOS simulator rather than a device.
	header := `{"app_name":"MyApp","timestamp":"2026","os_version":"iOS 17.5 Simulator","bug_type":"309"}`
	payload := `{"procName":"MyApp","procPath":"/Users/dev/Library/Developer/CoreSimulator/Devices/X/data/Containers/Bundle/Application/Y/MyApp.app/MyApp","cpuType":"X86-64","modelCode":"iPhone Simulator","exception":{"type":"EXC_BAD_ACCESS","codes":"0x1, 0x0","subtype":"KERN_INVALID_ADDRESS"},"faultingThread":0,"threads":[{"triggered":true,"frames":[{"imageOffset":0,"imageIndex":0}]}],"usedImages":[{"source":"P","arch":"x86_64","base":1,"size":1,"uuid":"aabbccdd-eeff-0011-2233-445566778899","name":"MyApp","path":"/Users/dev/.../MyApp"}]}`
	raw, err := ParseIPS([]byte(header + "\n" + payload))
	if err != nil {
		t.Fatalf("ParseIPS: %v", err)
	}
	if !raw.OS.IsSimulator {
		t.Error("IsSimulator = false; expected true from CoreSimulator procPath")
	}
	if raw.Arch != "x86_64" {
		t.Errorf("arch = %q, want x86_64 (from cpuType X86-64)", raw.Arch)
	}
}

func TestParseIPS_TerminationCodeHexFormat(t *testing.T) {
	// Watchdog-style crash: numeric termination.code must render as 0x-prefixed
	// hex so downstream categorize rules (case-insensitive match) fire.
	// 0x8BADF00D == 2343432205 decimal.
	header := `{"app_name":"MyApp","timestamp":"2026","os_version":"iOS 17","bug_type":"309"}`
	payload := `{"exception":{"type":"EXC_CRASH"},"termination":{"namespace":"FRONTBOARD","code":2343432205,"indicator":"0x8BADF00D (watchdog)"},"faultingThread":0,"threads":[{"triggered":true}],"usedImages":[]}`
	raw, err := ParseIPS([]byte(header + "\n" + payload))
	if err != nil {
		t.Fatalf("ParseIPS: %v", err)
	}
	// categorize rule uses EqualFold, so "0x8badf00d" or "0x8BADF00D" both work.
	if Categorize(raw).RuleID != "R-watchdog-01" {
		t.Errorf("categorize = %q, want R-watchdog-01 (termination.code = %q)",
			Categorize(raw).RuleID, raw.Termination.Code)
	}
}

func TestParseIPS_TerminationCodeStringPreserved(t *testing.T) {
	// Some .ips files quote termination.code directly as a hex string. Accept it.
	header := `{"app_name":"MyApp","timestamp":"2026","os_version":"iOS 17","bug_type":"309"}`
	payload := `{"exception":{"type":"EXC_CRASH"},"termination":{"namespace":"FRONTBOARD","code":"0xDEADFA11"},"faultingThread":0,"threads":[{"triggered":true}],"usedImages":[]}`
	raw, err := ParseIPS([]byte(header + "\n" + payload))
	if err != nil {
		t.Fatalf("ParseIPS: %v", err)
	}
	if Categorize(raw).RuleID != "R-user-quit-01" {
		t.Errorf("string termination.code not preserved (got rule=%q, code=%q)",
			Categorize(raw).RuleID, raw.Termination.Code)
	}
}

func TestParseIPS_UnsupportedFormat(t *testing.T) {
	_, err := ParseIPS([]byte(`not json at all`))
	if err == nil {
		t.Fatal("expected error for unknown format")
	}
}

func TestParseIPS_v2_TriggeredThreadFallback(t *testing.T) {
	// When faultingThread is absent, fall back to the first thread with
	// triggered=true. .ips v2 files sometimes omit faultingThread when only
	// a single triggered thread is present.
	header := `{"app_name":"MyApp","timestamp":"2026","os_version":"iOS 17","bug_type":"309"}`
	payload := `{"exception":{"type":"EXC_BAD_ACCESS","subtype":"KERN_INVALID_ADDRESS"},"threads":[{"triggered":false,"frames":[]},{"triggered":true,"frames":[{"imageOffset":0,"imageIndex":0}]}],"usedImages":[{"source":"P","arch":"arm64","base":1,"size":1,"uuid":"aabbccdd-eeff-0011-2233-445566778899","name":"MyApp","path":"/x"}]}`
	raw, err := ParseIPS([]byte(header + "\n" + payload))
	if err != nil {
		t.Fatalf("ParseIPS: %v", err)
	}
	if raw.CrashedIdx != 1 {
		t.Errorf("CrashedIdx = %d, want 1 (second thread has triggered=true)", raw.CrashedIdx)
	}
}

func TestParseIPS_v2_ArchFallbackToFirstImage(t *testing.T) {
	// When cpuType is missing, arch falls back to the first used image's arch.
	header := `{"app_name":"MyApp","timestamp":"2026","os_version":"iOS 17","bug_type":"309"}`
	payload := `{"exception":{"type":"EXC_BAD_ACCESS"},"threads":[{"triggered":true}],"usedImages":[{"source":"P","arch":"arm64e","base":1,"size":1,"uuid":"aabbccdd-eeff-0011-2233-445566778899","name":"MyApp","path":"/x"}]}`
	raw, err := ParseIPS([]byte(header + "\n" + payload))
	if err != nil {
		t.Fatalf("ParseIPS: %v", err)
	}
	if raw.Arch != "arm64e" {
		t.Errorf("arch = %q, want arm64e (from first image)", raw.Arch)
	}
}

// FuzzParseIPS seeds from every checked-in .ips fixture (v1 and v2) and
// asserts that ParseIPS never panics on arbitrary input. Errors are fine —
// the contract is only that malformed data surfaces as an error, never a
// crash. Budget: `make fuzz-ips` runs ≥60s; target ≥1M executions before
// release (the fuzztime on CI is whatever infrastructure allows).
func FuzzParseIPS(f *testing.F) {
	for _, dir := range []string{"testdata/crashes/ips_v1", "testdata/crashes/ips_v2"} {
		entries, err := os.ReadDir(dir)
		if err != nil {
			f.Logf("seed dir %s: %v", dir, err)
			continue
		}
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			data, err := os.ReadFile(filepath.Join(dir, e.Name()))
			if err != nil {
				continue
			}
			f.Add(data)
		}
	}
	f.Fuzz(func(t *testing.T, data []byte) {
		// Must not panic. Any error return is acceptable. We also tolerate
		// *HangError specifically — it's an expected typed error for
		// bug_type=298 and proves the parser handled the input correctly.
		_, _ = ParseIPS(data)
	})
}
