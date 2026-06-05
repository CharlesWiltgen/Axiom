package main

import (
	"bytes"
	"strings"
	"testing"
)

// notJSON asserts the rendered output is prose, not a JSON object.
func notJSON(t *testing.T, s string) {
	t.Helper()
	if strings.HasPrefix(strings.TrimSpace(s), "{") {
		t.Errorf("expected prose, got JSON-looking output:\n%s", s)
	}
}

func mustContain(t *testing.T, s string, subs ...string) {
	t.Helper()
	for _, sub := range subs {
		if !strings.Contains(s, sub) {
			t.Errorf("output missing %q:\n%s", sub, s)
		}
	}
}

func TestRenderResolveHuman(t *testing.T) {
	var buf bytes.Buffer
	renderResolveHuman(&buf, resolveOutput{
		Dsym: "/A.dSYM", Arch: "arm64", Load: "0x1000",
		Results: []resolveResult{
			{Address: "0x1100", Symbol: "doWork", File: "Work.swift", Line: 42, Symbolicated: true},
			{Address: "0x2200", Raw: "0x2200", Symbolicated: false},
		},
	})
	out := buf.String()
	notJSON(t, out)
	mustContain(t, out, "/A.dSYM", "arm64", "0x1000", "doWork", "Work.swift:42", "0x2200", "[unsymbolicated]")
}

func TestRenderFindDsymHuman(t *testing.T) {
	var buf bytes.Buffer
	renderFindDsymHuman(&buf, findDsymOutput{
		UUID: "ABC", Path: "/x/A.dSYM", Arch: "arm64e", ImageName: "App", Source: "archives",
	})
	out := buf.String()
	notJSON(t, out)
	mustContain(t, out, "ABC", "found:", "/x/A.dSYM", "arm64e", "App", "archives")
}

func TestRenderListDsymsHuman(t *testing.T) {
	var buf bytes.Buffer
	renderListDsymsHuman(&buf, listDsymsOutput{
		Roots: []string{"/r1", "/r2"},
		Bundles: []dsymBundle{
			{Path: "/r1/A.dSYM", Source: "archives", UUIDs: []bundleUUID{{UUID: "U1", Arch: "arm64"}}},
		},
	})
	out := buf.String()
	notJSON(t, out)
	mustContain(t, out, "1 bundle(s) across 2 root(s)", "/r1/A.dSYM", "archives", "U1", "arm64")

	var empty bytes.Buffer
	renderListDsymsHuman(&empty, listDsymsOutput{Roots: []string{"/r1"}})
	mustContain(t, empty.String(), "0 bundle(s) across 1 root(s)")
}

func TestRenderVerifyHuman(t *testing.T) {
	var buf bytes.Buffer
	renderVerifyHuman(&buf, verifyOutput{
		Category: "partial",
		Input:    InputInfo{Path: "/c.ips", Format: "ips_json_v1"},
		Images: ImageStatus{
			Matched:    []ImageMatch{{UUID: "M1", Name: "Lib"}},
			Mismatched: []ImageMatch{{UUID: "X1", Name: "Other", Kind: "uuid"}},
			Missing:    []ImageMiss{{UUID: "Z1", Name: "Phantom"}},
		},
	})
	out := buf.String()
	notJSON(t, out)
	mustContain(t, out, "partial", "/c.ips", "matched: 1", "mismatched: 1", "missing: 1", "Phantom", "Z1", "Other", "X1")
}

func TestRenderCrashHuman(t *testing.T) {
	var buf bytes.Buffer
	renderCrashHuman(&buf, &CrashReport{
		Crash: CrashInfo{
			App:               AppInfo{Name: "MyApp", Version: "1.2", BundleID: "com.x.my"},
			OS:                OSInfo{Platform: "iOS", Version: "26.0", Build: "23A1", IsSimulator: true},
			Exception:         Exception{Type: "EXC_BREAKPOINT", Signal: "SIGTRAP", Subtype: "nil unwrap"},
			PatternTag:        "swift_forced_unwrap",
			PatternConfidence: "high",
			PatternReason:     "force-unwrapped a nil Optional",
			CrashedThread: Thread{Index: 0, Frames: []Frame{
				{Index: 0, Symbol: "boom", File: "F.swift", Line: 9, Symbolicated: true},
				{Index: 1, Address: "0x99", Image: "UIKitCore"},
			}},
		},
		Images: &ImageStatus{Matched: []ImageMatch{{}}, Missing: []ImageMiss{{}}},
	})
	out := buf.String()
	notJSON(t, out)
	mustContain(t, out,
		"swift_forced_unwrap", "high", "MyApp 1.2", "com.x.my", "iOS 26.0", "simulator",
		"EXC_BREAKPOINT / SIGTRAP", "nil unwrap", "force-unwrapped a nil Optional",
		"crashed thread 0", "boom", "F.swift:9", "0x99", "UIKitCore",
		"1 matched", "1 missing")
}

// TestWriteJSONCompact guards the token-lean contract: the report JSON path must
// stay single-line (no indentation). Reintroducing enc.SetIndent fails this.
func TestWriteJSONCompact(t *testing.T) {
	var buf bytes.Buffer
	if err := writeJSON(&buf, "", map[string]any{"a": 1, "nested": map[string]any{"b": 2}}); err != nil {
		t.Fatal(err)
	}
	out := buf.String()
	if strings.Contains(out, "\n  ") {
		t.Errorf("writeJSON output is indented (should be compact):\n%s", out)
	}
	if strings.Count(out, "\n") != 1 { // exactly the encoder's trailing newline
		t.Errorf("compact JSON should be a single line, got %d newlines:\n%s", strings.Count(out, "\n"), out)
	}
}
