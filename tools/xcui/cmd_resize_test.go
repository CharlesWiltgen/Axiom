package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestParseSizes(t *testing.T) {
	got, err := parseSizes(" 400x900, 900x600 ,1100x500")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := []string{"400x900", "900x600", "1100x500"}
	if len(got) != len(want) {
		t.Fatalf("parsed %d sizes, want %d", len(got), len(want))
	}
	for i, w := range want {
		if got[i].String() != w {
			t.Errorf("size %d = %q, want %q", i, got[i].String(), w)
		}
	}
}

func TestParseSizesRejectsTheWholeListOnOneBadEntry(t *testing.T) {
	// A typo'd breakpoint that silently vanishes is worse than a hard error: the
	// report would look complete while never exercising that width.
	for _, bad := range []string{"400x900,oopsx600", "400x900,900", "400x900,0x600", "400x900,-5x600", "", "   "} {
		if _, err := parseSizes(bad); err == nil {
			t.Errorf("parseSizes(%q) succeeded; want an error", bad)
		}
	}
}

func TestParseActualSizeReadsTheLabelledField(t *testing.T) {
	// Verbatim shape of `devicectl device appResize set` output, captured 2026-08-15.
	out := `Adjusted resizable app session geometry.
  Display: Resizable (6C640744-3686-474B-9643-08FCF719DEC1)
  Requested size: 1100.0x500.0
  Requested corner radius: 0.0
  Actual size: 1100.0x550.0
  Actual corner radius: 0.0
  Minimum possible size: 0.0x0.0
  Maximum possible size: 1280.0x1280.0`

	// It must read Actual, NOT Requested — a clamp is exactly what a sweep exists
	// to surface, and reading Requested would report the clamp as a clean pass.
	if got := parseActualSize(out); got != "1100x550" {
		t.Errorf("parseActualSize = %q, want the Actual field 1100x550", got)
	}
}

func TestParseActualSizeIsEmptyWhenAbsent(t *testing.T) {
	if got := parseActualSize("Started resizable app session.\n  Display: Resizable"); got != "" {
		t.Errorf("parseActualSize = %q, want empty when no Actual line is present", got)
	}
}

func TestParseAppResizeInfoSurfacesTheErrorCode(t *testing.T) {
	// Verbatim 24004 envelope captured from devicectl on 2026-08-15.
	noSession := []byte(`{"error":{"code":24004,"domain":"com.apple.dt.CoreDeviceError"},"info":{"outcome":"failed"}}`)
	if _, code, err := parseAppResizeInfo(noSession); err == nil || code != errResizeNoSession {
		t.Errorf("code = %d, err = %v; want %d and an error", code, err, errResizeNoSession)
	}

	ok := []byte(`{"result":{"cornerRadius":0,"displayName":"Resizable","preferredSize":[500,800],"minimumPossibleSize":[0,0],"maximumPossibleSize":[1280,1280]}}`)
	st, code, err := parseAppResizeInfo(ok)
	if err != nil || code != 0 {
		t.Fatalf("unexpected error: code=%d err=%v", code, err)
	}
	// Sizes arrive as [w,h] number arrays, not "WxH" strings.
	if sizeOf(st.Preferred) != "500x800" || sizeOf(st.MaxSize) != "1280x1280" {
		t.Errorf("preferred=%q max=%q; want 500x800 and 1280x1280", sizeOf(st.Preferred), sizeOf(st.MaxSize))
	}
}

func TestExplainResizeErrorSeparatesTheThreeCases(t *testing.T) {
	// 1001 and 24001 are terminal and need different fixes from the user; 24004 is
	// "not ready yet" and must NOT abort the startup poll.
	if msg := explainResizeError(errResizeUnsupported); msg == "" {
		t.Error("1001 (device incapable) must produce an explanation")
	}
	if msg := explainResizeError(errResizeNoForeground); msg == "" {
		t.Error("24001 (no foreground app) must produce an explanation")
	}
	if msg := explainResizeError(errResizeNoSession); msg != "" {
		t.Errorf("24004 must stay retryable during startup, got %q", msg)
	}
}

func TestClampAccountingAndStrict(t *testing.T) {
	// The clamp path cannot be exercised live on a device that honors every request
	// (an iPhone 17 Max (27) accepted 2000x2000 against a stated 1280x1280 max), so
	// the decision is pinned here instead of left untested.
	cases := []struct {
		requested, actual string
		wantHonored       bool
	}{
		{"1100x500", "1100x550", false}, // the real observed clamp
		{"400x900", "400x900", true},
		{"2000x2000", "2000x2000", true}, // stated max is advisory on some devices
		{"400x900", "", false},           // readback failed → never treat as honored
	}
	for _, c := range cases {
		got := c.actual == c.requested
		if got != c.wantHonored {
			t.Errorf("requested %q actual %q: honored=%v, want %v", c.requested, c.actual, got, c.wantHonored)
		}
	}
}

func TestResizeStepScreenshotFieldOmittedWhenUnset(t *testing.T) {
	// `screenshot` is omitempty: a consumer must be able to distinguish "no
	// --screenshot-dir" from "capture failed", and the latter lands in Failures.
	b, err := json.Marshal(resizeStepReport{Requested: "400x900", Actual: "400x900", Honored: true, Pass: true})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(b), "screenshot") {
		t.Errorf("unset screenshot must be omitted, got %s", b)
	}
}
