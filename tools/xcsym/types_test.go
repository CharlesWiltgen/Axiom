package main

import (
	"encoding/json"
	"testing"
)

func TestCrashReportJSONRoundTrip(t *testing.T) {
	report := CrashReport{
		Tool:    "xcsym",
		Version: "0.1.0",
		Format:  "standard",
		Input:   InputInfo{Path: "foo.ips", Format: "ips_json_v2"},
		Crash: CrashInfo{
			App:  AppInfo{Name: "MyApp", Version: "1.0", BundleID: "com.example"},
			OS:   OSInfo{Platform: "iOS", Version: "18.2", Build: "22C152"},
			Arch: "arm64e",
			Exception: Exception{
				Type: "EXC_BREAKPOINT", Codes: "0x1", Subtype: "Swift runtime failure",
			},
			PatternTag:        "swift_forced_unwrap",
			PatternConfidence: "high",
			PatternRuleID:     "R-swift-unwrap-01",
			CrashedThread: Thread{
				Index: 0,
				Frames: []Frame{
					{Index: 0, Address: "0x1045a8b2c", Image: "MyApp", Symbolicated: true, Symbol: "ContentView.body"},
				},
			},
		},
		Images: &ImageStatus{
			Matched:    []ImageMatch{{UUID: "AAAA", Name: "MyApp", Arch: "arm64e", DsymPath: "/path"}},
			Mismatched: []ImageMatch{},
			Missing:    []ImageMiss{},
		},
		Warnings: []string{},
	}

	data, err := json.Marshal(report)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var back CrashReport
	if err := json.Unmarshal(data, &back); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if back.Crash.PatternTag != "swift_forced_unwrap" {
		t.Errorf("round-trip lost pattern_tag: %q", back.Crash.PatternTag)
	}
	if len(back.Crash.CrashedThread.Frames) != 1 {
		t.Errorf("round-trip lost frames")
	}
}
