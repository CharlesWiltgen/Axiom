package main

import "testing"

func TestBuildRawCrash_MapsCoreFields(t *testing.T) {
	r := &NormalizedReport{
		Kind:          "crash",
		Exception:     NRException{Type: "EXC_BAD_ACCESS", Subtype: "KERN_INVALID_ADDRESS", MachException: "0xDEAD10CC"},
		CrashedThread: 2,
		Threads: []NRThread{
			{Index: 0, Frames: []NRFrame{{Image: "CoreFoundation", Symbol: "CFRunLoopRun"}}},
			{Index: 1, Frames: []NRFrame{{Image: "Foundation", Symbol: "x"}}},
			{Index: 2, Crashed: true, Frames: []NRFrame{{Image: "MyApp", Symbol: "boom", InApp: true}}},
		},
	}
	raw := buildRawCrashFromNormalizedReport(r)
	if raw.Format != FormatNormalized || raw.Kind != "crash" {
		t.Fatalf("format/kind: %+v", raw)
	}
	if raw.CrashedIdx != 2 {
		t.Fatalf("CrashedIdx = %d, want 2 (slice position of crashed_thread)", raw.CrashedIdx)
	}
	if raw.Termination.Code != "0xdead10cc" {
		t.Fatalf("Termination.Code = %q, want 0xdead10cc", raw.Termination.Code)
	}
	if !raw.Threads[2].Frames[0].InApp || !raw.Threads[2].Triggered {
		t.Fatalf("InApp/Triggered not threaded: %+v", raw.Threads[2])
	}
}

func TestBuildRawCrash_DataProtClassifies(t *testing.T) {
	// End-to-end through the REAL adapter (no forced field): an uppercase
	// mach_exception must be normalized AND reach R-data-prot-01 via Categorize.
	r := &NormalizedReport{Kind: "crash", Exception: NRException{MachException: "0xDEAD10CC"}}
	raw := buildRawCrashFromNormalizedReport(r)
	if got := Categorize(raw).Tag; got != "data_protection_violation" {
		t.Fatalf("Categorize tag = %q, want data_protection_violation (adapter must set+normalize Termination.Code)", got)
	}
}

func TestBuildRawCrash_CrashedThreadFallback(t *testing.T) {
	// crashed_thread omitted (0) but no thread has index 0 → CrashedIdx falls
	// back to the thread flagged Crashed, else 0.
	r := &NormalizedReport{Kind: "hang", Threads: []NRThread{{Index: 4, Crashed: true, Frames: nil}}}
	raw := buildRawCrashFromNormalizedReport(r)
	if raw.CrashedIdx != 0 {
		t.Fatalf("CrashedIdx = %d, want 0 (slice position of the Crashed thread)", raw.CrashedIdx)
	}
}

func TestBuildRawCrash_PrefersCrashedFlagOverDefaultIndex(t *testing.T) {
	r := &NormalizedReport{Kind: "crash", Threads: []NRThread{
		{Index: 3, Crashed: true, Frames: []NRFrame{{Image: "App", Symbol: "boom", InApp: true}}},
		{Index: 0, Crashed: false, Frames: []NRFrame{{Image: "CoreFoundation", Symbol: "x"}}},
	}}
	raw := buildRawCrashFromNormalizedReport(r)
	if raw.CrashedIdx != 0 {
		t.Fatalf("CrashedIdx = %d, want 0 (Crashed-flagged thread wins over default Index 0)", raw.CrashedIdx)
	}
}

func TestNormalizeTerminationCode(t *testing.T) {
	cases := map[string]string{
		"0xDEAD10CC": "0xdead10cc",
		"0xdead10cc": "0xdead10cc",
		"3735883980": "0xdead10cc", // decimal form of 0xdead10cc
		"0x8BADF00D": "0x8badf00d",
		"":           "",
		"garbage":    "garbage", // pass-through, lowercased
	}
	for in, want := range cases {
		if got := normalizeTerminationCode(in); got != want {
			t.Errorf("normalizeTerminationCode(%q) = %q, want %q", in, got, want)
		}
	}
}
