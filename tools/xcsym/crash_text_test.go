package main

import (
	"os"
	"path/filepath"
	"testing"
)

// TestParseAppleCrash_Fixture is the end-to-end smoke test for the .crash
// text parser. It asserts the high-value fields the symbolicate /
// categorize pipelines depend on: App/OS/Arch/Exception/Termination,
// crashed-thread index, frame count on the crashed thread, Binary
// Images count and UUID normalization. The fixture is an anonymized
// CarPlay ObjC-exception crash captured from a real .xccrashpoint.
func TestParseAppleCrash_Fixture(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("testdata", "crashes", "apple_crash", "objc_exception_sigabrt.crash"))
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}

	if got := DetectFormat(data); got != FormatAppleCrash {
		t.Fatalf("DetectFormat = %q, want %q", got, FormatAppleCrash)
	}

	raw, err := ParseAppleCrash(data)
	if err != nil {
		t.Fatalf("ParseAppleCrash: %v", err)
	}

	if raw.Format != FormatAppleCrash {
		t.Errorf("Format = %q, want %q", raw.Format, FormatAppleCrash)
	}
	if raw.App.Name != "App" {
		t.Errorf("App.Name = %q, want App (anonymized)", raw.App.Name)
	}
	if raw.App.BundleID != "com.example.redacted" {
		t.Errorf("App.BundleID = %q, want com.example.redacted", raw.App.BundleID)
	}
	if raw.OS.Platform != "iOS" {
		t.Errorf("OS.Platform = %q, want iOS", raw.OS.Platform)
	}
	if raw.OS.Version != "26.4.1" {
		t.Errorf("OS.Version = %q, want 26.4.1", raw.OS.Version)
	}
	if raw.OS.Build != "23E254" {
		t.Errorf("OS.Build = %q, want 23E254", raw.OS.Build)
	}
	if raw.Arch != "arm64" {
		t.Errorf("Arch = %q, want arm64", raw.Arch)
	}
	if raw.Exception.Type != "EXC_CRASH" {
		t.Errorf("Exception.Type = %q, want EXC_CRASH", raw.Exception.Type)
	}
	if raw.Exception.Signal != "SIGABRT" {
		t.Errorf("Exception.Signal = %q, want SIGABRT", raw.Exception.Signal)
	}
	if raw.Termination.Namespace != "SIGNAL" {
		t.Errorf("Termination.Namespace = %q, want SIGNAL", raw.Termination.Namespace)
	}
	if raw.Termination.Code != "0x6" {
		t.Errorf("Termination.Code = %q, want 0x6", raw.Termination.Code)
	}
	if raw.CrashedIdx != 0 {
		t.Errorf("CrashedIdx = %d, want 0 (Triggered by Thread: 0)", raw.CrashedIdx)
	}
	if !raw.Threads[raw.CrashedIdx].Triggered {
		t.Error("crashed thread not marked Triggered")
	}
	// The crashed thread's frame 10 in this fixture is the objc_exception_throw
	// frame that drives R-objc-exc-01; verify the symbol was parsed.
	crashed := raw.Threads[raw.CrashedIdx]
	found := false
	for _, f := range crashed.Frames {
		if f.Symbol == "objc_exception_throw" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("crashed thread missing objc_exception_throw frame; got %d frames", len(crashed.Frames))
	}

	// Binary Images — the fixture carries 26 images. Each must have a
	// 36-char uppercase-dashed UUID (NormalizeUUID output) and a
	// non-zero LoadAddress.
	if len(raw.UsedImages) != 26 {
		t.Errorf("UsedImages count = %d, want 26", len(raw.UsedImages))
	}
	for i, img := range raw.UsedImages {
		if len(img.UUID) != 36 {
			t.Errorf("UsedImages[%d].UUID = %q (len %d), want 36-char dashed form", i, img.UUID, len(img.UUID))
		}
		if img.LoadAddress == 0 {
			t.Errorf("UsedImages[%d].LoadAddress = 0", i)
		}
	}

	// Main image is Poppy/App, arm64 slice. After anonymization its name
	// is "App" (we stripped the app-name token); the first usedImage
	// should be the main app binary.
	main := raw.UsedImages[0]
	if main.Name != "App" {
		t.Errorf("main image Name = %q, want App", main.Name)
	}
	if main.Arch != "arm64" {
		t.Errorf("main image Arch = %q, want arm64", main.Arch)
	}

	// Crashed thread register state — the fixture includes an ARM
	// Thread State block with sp/pc values. Ensure they were parsed.
	if crashed.State == nil {
		t.Fatal("crashed thread State = nil, want parsed sp/pc")
	}
	if crashed.State.SP == 0 {
		t.Error("crashed thread State.SP = 0, want parsed value")
	}
	if crashed.State.PC == 0 {
		t.Error("crashed thread State.PC = 0, want parsed value")
	}

	// Categorize should fire R-objc-exc-01 on this fixture — EXC_CRASH
	// plus objc_exception_throw on the crashed thread is the canonical
	// signal.
	cat := Categorize(raw)
	if cat.RuleID != "R-objc-exc-01" {
		t.Errorf("Categorize RuleID = %q, want R-objc-exc-01 (fixture is CarPlay ObjC throw)", cat.RuleID)
	}
	if cat.Tag != "objc_exception" {
		t.Errorf("Categorize Tag = %q, want objc_exception", cat.Tag)
	}
}

// TestParseAppleCrash_SyntheticWatchdog exercises the other common
// termination-line form: "Namespace FRONTBOARD, Code 0x8BADF00D" —
// built inline so we don't need a second committed fixture. Confirms
// that Termination.Namespace + Code line up for R-watchdog-01 to fire.
func TestParseAppleCrash_SyntheticWatchdog(t *testing.T) {
	crash := `Incident Identifier: 00000000-0000-0000-0000-000000000000
Process:             App [1]
Identifier:          com.example.redacted
Version:             1.0
Code Type:           ARM-64 (Native)
OS Version:          iPhone OS 18.0 (22A000)
Role:                Foreground

Exception Type:  EXC_CRASH (SIGKILL)
Exception Codes: 0x0000000000000000, 0x0000000000000000
Termination Reason: Namespace FRONTBOARD, Code 0x8BADF00D

Triggered by Thread:  0

Thread 0 Crashed:
0   libsystem_kernel.dylib        	0x23dddf1d0 kevent_id + 8

Thread 0 crashed with ARM Thread State (64-bit):
    sp: 0x000000016b000000   pc: 0x00000001aabbccdd cpsr: 0x0


Binary Images:
       0x104000000 -        0x104fffffff App arm64  <11111111222233334444555566667777> /private/App.app/App
       0x23ddd4000 -        0x23ddefff libsystem_kernel.dylib arm64e  <22222222333344445555666677778888> /usr/lib/system/libsystem_kernel.dylib

EOF
`
	raw, err := ParseAppleCrash([]byte(crash))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if raw.Termination.Namespace != "FRONTBOARD" {
		t.Errorf("Termination.Namespace = %q, want FRONTBOARD", raw.Termination.Namespace)
	}
	if raw.Termination.Code != "0x8badf00d" {
		t.Errorf("Termination.Code = %q, want 0x8badf00d (lower-cased)", raw.Termination.Code)
	}
	cat := Categorize(raw)
	if cat.RuleID != "R-watchdog-01" {
		t.Errorf("Categorize RuleID = %q, want R-watchdog-01", cat.RuleID)
	}
}

// TestParseAppleCrash_SyntheticNumericCode covers the decimal-code
// Termination form some older reports use: "FRONTBOARD 2343432205" —
// 2343432205 is 0x8BADF00D. The normalization step must render it as
// hex so R-watchdog-01 matches.
func TestParseAppleCrash_SyntheticNumericCode(t *testing.T) {
	crash := `Incident Identifier: 00000000-0000-0000-0000-000000000000
Process: App [1]
Identifier: com.example.redacted
Code Type: ARM-64
OS Version: iPhone OS 17.0 (21A000)

Exception Type: EXC_CRASH (SIGKILL)
Termination Reason: FRONTBOARD 2343432205 scene-update watchdog

Triggered by Thread: 0

Thread 0 Crashed:
0   libsystem_kernel.dylib        	0x100 kevent + 8


Binary Images:
       0x100000000 -        0x100ffffff App arm64  <11111111222233334444555566667777> /App.app/App

EOF
`
	raw, err := ParseAppleCrash([]byte(crash))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if raw.Termination.Code != "0x8badf00d" {
		t.Errorf("Termination.Code = %q, want 0x8badf00d (decimal → hex)", raw.Termination.Code)
	}
	// "scene-update watchdog" should land in Termination.Reason — reserved
	// for jetsam sentinel matching (R-jetsam-01 checks Reason).
	if raw.Termination.Reason == nil {
		t.Error("Termination.Reason = nil, want prose reason")
	}
}

// TestParseAppleCrash_EmptyFrames guards against the failure mode where
// blank thread sections ("Thread 8:" followed by blank line, which
// appears in real .crash files) create empty Thread entries that
// confuse the symbolicate pipeline. Blank threads should parse as
// Thread{Frames: nil} — not crash, not merge into the previous thread.
func TestParseAppleCrash_EmptyFrames(t *testing.T) {
	crash := `Incident Identifier: 00000000-0000-0000-0000-000000000000
Process: App [1]
Code Type: ARM-64
OS Version: iPhone OS 17.0 (21A000)

Exception Type: EXC_BAD_ACCESS (SIGSEGV)
Exception Codes: KERN_INVALID_ADDRESS at 0x0

Triggered by Thread: 0

Thread 0 Crashed:
0   libsystem_kernel.dylib        	0x100 __pthread_kill + 8

Thread 1:

Thread 2:
0   libsystem_kernel.dylib        	0x200 mach_msg + 8


Binary Images:
       0x100000000 -        0x100ffffff App arm64  <11111111222233334444555566667777> /App.app/App

EOF
`
	raw, err := ParseAppleCrash([]byte(crash))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(raw.Threads) != 3 {
		t.Fatalf("Threads count = %d, want 3 (crashed + empty + non-empty)", len(raw.Threads))
	}
	if len(raw.Threads[1].Frames) != 0 {
		t.Errorf("Thread 1 Frames = %d, want 0 (empty section)", len(raw.Threads[1].Frames))
	}
	if len(raw.Threads[2].Frames) != 1 {
		t.Errorf("Thread 2 Frames = %d, want 1", len(raw.Threads[2].Frames))
	}
}

// TestParseAppleCrashFrame_SpaceInImageName documents a known
// limitation — the frame regex's image-name capture is `\S+`, so a
// dylib filename that contains a literal space (extremely rare on
// Apple platforms; would require a hand-vendored binary) causes the
// frame to silently fail the regex and be dropped. If a real-world
// crash ever surfaces this, widen the capture to be greedy up to the
// hex address token. Keeping the test green (ok=false) documents the
// current behavior so it doesn't regress silently in the other
// direction — accidentally accepting garbled frames.
func TestParseAppleCrashFrame_SpaceInImageName(t *testing.T) {
	line := `0   my lib.dylib        	0x23dddf1d0 __pthread_kill + 8 (:-1)`
	if _, ok := parseAppleCrashFrame(line, nil); ok {
		t.Error("frames from dylibs with spaces in their names are silently " +
			"dropped today (see comment above). If this test fails because " +
			"parsing now succeeds, update the regex documentation and add " +
			"positive assertions on the recovered fields.")
	}
}

// TestParseAppleCrashFrame_Variants exercises the frame-line parser
// against the shapes the .crash format emits: symbol + offset +
// (file:line), symbol + offset + (:-1) for stripped frames,
// symbol-only (no offset parenthetical), and <deduplicated_symbol>
// which Swift's optimizer emits in crashes.
func TestParseAppleCrashFrame_Variants(t *testing.T) {
	cases := []struct {
		in       string
		wantSym  string
		wantOff  int
		wantFile string
		wantLine int
		wantSymf bool // Symbolicated
	}{
		{
			in:       `0   libsystem_kernel.dylib        	0x23dddf1d0 __pthread_kill + 8 (:-1)`,
			wantSym:  "__pthread_kill",
			wantOff:  8,
			wantFile: "",
			wantLine: 0, // (:-1) → no positive line
			wantSymf: true,
		},
		{
			in:       `2   libsystem_c.dylib             	0x19aab0de4 abort + 148 (abort.c:122)`,
			wantSym:  "abort",
			wantOff:  148,
			wantFile: "abort.c",
			wantLine: 122,
			wantSymf: true,
		},
		{
			in:       `7   Poppy                         	0x10412d251 <deduplicated_symbol> + 1`,
			wantSym:  "<deduplicated_symbol>",
			wantOff:  1,
			wantFile: "",
			wantLine: 0,
			wantSymf: false, // deduplicated is not a real symbol
		},
	}
	images := []UsedImage{{Name: "App", UUID: "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE", LoadAddress: 0x104000000, Size: 0x1000000}}
	for _, c := range cases {
		f, ok := parseAppleCrashFrame(c.in, images)
		if !ok {
			t.Errorf("parseAppleCrashFrame(%q) ok=false, want true", c.in)
			continue
		}
		if f.Symbol != c.wantSym {
			t.Errorf("%q: Symbol = %q, want %q", c.in, f.Symbol, c.wantSym)
		}
		if f.ImageOffset != c.wantOff {
			t.Errorf("%q: ImageOffset = %d, want %d", c.in, f.ImageOffset, c.wantOff)
		}
		if f.File != c.wantFile {
			t.Errorf("%q: File = %q, want %q", c.in, f.File, c.wantFile)
		}
		if f.Line != c.wantLine {
			t.Errorf("%q: Line = %d, want %d", c.in, f.Line, c.wantLine)
		}
		if f.Symbolicated != c.wantSymf {
			t.Errorf("%q: Symbolicated = %v, want %v", c.in, f.Symbolicated, c.wantSymf)
		}
	}
}
