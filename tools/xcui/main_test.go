package main

import (
	"context"
	"errors"
	"reflect"
	"testing"
)

func TestVersionConstSet(t *testing.T) {
	if version == "" {
		t.Fatal("version const must be set")
	}
}

const sampleTree = `[
  {
    "AXUniqueId": null, "AXLabel": "App", "AXValue": null,
    "role": "AXApplication", "type": "Application", "enabled": true,
    "frame": {"x":0,"y":0,"width":402,"height":874},
    "children": [
      {
        "AXUniqueId": "artist.hero", "AXLabel": "Artwork for The Chemical Brothers",
        "AXValue": null, "role": "AXImage", "type": "Image", "enabled": true,
        "frame": {"x":0,"y":0,"width":402,"height":402}, "children": []
      },
      {
        "AXUniqueId": "play.all", "AXLabel": "Play all", "AXValue": null,
        "role": "AXButton", "type": "Button", "enabled": true,
        "frame": {"x":16,"y":420,"width":120,"height":44}, "children": []
      }
    ]
  }
]`

func TestParseDescribeUI(t *testing.T) {
	roots, err := parseDescribeUI([]byte(sampleTree))
	if err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if len(roots) != 1 || len(roots[0].Children) != 2 {
		t.Fatalf("got %d roots / %d children, want 1 / 2", len(roots), len(roots[0].Children))
	}
}

func TestFindByID(t *testing.T) {
	roots, _ := parseDescribeUI([]byte(sampleTree))
	matches := findByID(roots, "artist.hero")
	if len(matches) != 1 {
		t.Fatalf("got %d matches, want 1", len(matches))
	}
	if got := deref(matches[0].AXLabel); got != "Artwork for The Chemical Brothers" {
		t.Errorf("label = %q", got)
	}
}

func TestFindByIDAbsent(t *testing.T) {
	roots, _ := parseDescribeUI([]byte(sampleTree))
	if matches := findByID(roots, "nope"); len(matches) != 0 {
		t.Errorf("got %d matches, want 0", len(matches))
	}
}

func FuzzParseDescribeUI(f *testing.F) {
	f.Add([]byte(sampleTree))
	f.Add([]byte(`[]`))
	f.Add([]byte(`[{"AXUniqueId":null,"children":[]}]`))
	f.Fuzz(func(t *testing.T, data []byte) {
		_, _ = parseDescribeUI(data) // must not panic
	})
}

const sampleDevices = `{"devices":{
  "com.apple.CoreSimulator.SimRuntime.iOS-26-0":[
    {"udid":"AAAA","state":"Shutdown","name":"iPhone 16"},
    {"udid":"BBBB","state":"Booted","name":"iPhone 16 Pro"}
  ]}}`

func TestPickBootedUDID(t *testing.T) {
	udid, err := pickBootedUDID([]byte(sampleDevices))
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if udid != "BBBB" {
		t.Errorf("udid = %q, want BBBB", udid)
	}
}

func TestPickBootedUDIDNoneBooted(t *testing.T) {
	none := `{"devices":{"r":[{"udid":"AAAA","state":"Shutdown","name":"x"}]}}`
	if _, err := pickBootedUDID([]byte(none)); err == nil {
		t.Error("expected error when no sim booted")
	}
}

// Two same-named devices on different runtimes is the real-world shape: the
// runtime is the only thing that tells "iPhone 17 (26.5)" from "iPhone 17 (27)".
const threeBootedTwoRuntimes = `{"devices":{
  "com.apple.CoreSimulator.SimRuntime.iOS-27-0":[
    {"udid":"ZZZZ","state":"Booted","name":"iPhone 17"},
    {"udid":"MMMM","state":"Shutdown","name":"iPad"}
  ],
  "com.apple.CoreSimulator.SimRuntime.iOS-26-5":[
    {"udid":"AAAA","state":"Booted","name":"iPhone 17"}
  ],
  "com.apple.CoreSimulator.SimRuntime.iOS-27-1":[
    {"udid":"DDDD","state":"Booted","name":"iPhone Duo"}
  ]}}`

// Sorted by UDID so the refusal lists devices in the same order every run
// (Go map iteration order is randomized).
func TestBootedSimsSortedWithRuntime(t *testing.T) {
	got, err := bootedSims([]byte(threeBootedTwoRuntimes))
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	want := []bootedSim{
		{UDID: "AAAA", Name: "iPhone 17", Runtime: "iOS 26.5"},
		{UDID: "DDDD", Name: "iPhone Duo", Runtime: "iOS 27.1"},
		{UDID: "ZZZZ", Name: "iPhone 17", Runtime: "iOS 27.0"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("bootedSims = %+v, want %+v", got, want)
	}
}

func TestBootedSimsNoneBooted(t *testing.T) {
	none := `{"devices":{"r":[{"udid":"AAAA","state":"Shutdown","name":"x"}]}}`
	got, err := bootedSims([]byte(none))
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !reflect.DeepEqual(got, []bootedSim(nil)) {
		t.Errorf("bootedSims = %#v, want nil", got)
	}
}

func TestRuntimeLabel(t *testing.T) {
	cases := map[string]string{
		"com.apple.CoreSimulator.SimRuntime.iOS-26-5":     "iOS 26.5",
		"com.apple.CoreSimulator.SimRuntime.watchOS-27-0": "watchOS 27.0",
		"com.apple.CoreSimulator.SimRuntime.xrOS-27-0":    "xrOS 27.0",
		"com.apple.CoreSimulator.SimRuntime.iOS":          "iOS", // no version suffix
		"r":                                               "r",   // unrecognized shape passes through rather than vanishing
	}
	for in, want := range cases {
		if got := runtimeLabel(in); got != want {
			t.Errorf("runtimeLabel(%q) = %q, want %q", in, got, want)
		}
	}
}

// With 2+ booted, a silent pick drove the WRONG device while every tap printed
// ✓ (six calls, measured in a downstream project 2026-08-31). The refusal must
// name every candidate so the caller can retry with --udid in one step.
func TestPickBootedUDIDRefusesWhenSeveralBooted(t *testing.T) {
	udid, err := pickBootedUDID([]byte(threeBootedTwoRuntimes))
	if udid != "" {
		t.Errorf("udid = %q, want empty — no device may be guessed", udid)
	}
	var amb *ambiguousSimError
	if !errors.As(err, &amb) {
		t.Fatalf("err = %v, want *ambiguousSimError", err)
	}
	want := "3 simulators are booted and no --udid was given; refusing to guess which one to drive. " +
		"Re-run with --udid set to one of:\n" +
		"  AAAA  iPhone 17 (iOS 26.5)\n" +
		"  DDDD  iPhone Duo (iOS 27.1)\n" +
		"  ZZZZ  iPhone 17 (iOS 27.0)"
	if err.Error() != want {
		t.Errorf("message =\n%s\nwant\n%s", err.Error(), want)
	}
}

func TestResolveUDIDExplicitSkipsAmbiguityCheck(t *testing.T) {
	// --udid is the escape hatch: it must never consult simctl. Asserted on the
	// exec seam, not just the return value — otherwise deleting the early return
	// would shell out to the developer's real simctl and the test would still pass.
	calls := withFakeExec(t, threeBootedTwoRuntimes)
	got, err := resolveUDID(context.Background(), "DDDD")
	if err != nil || got != "DDDD" {
		t.Errorf("resolveUDID(explicit) = %q, %v; want DDDD, nil", got, err)
	}
	if len(*calls) != 0 {
		t.Errorf("ran %d subprocess(es), want none", len(*calls))
	}
}

func TestDoctorExitCode(t *testing.T) {
	cases := []struct {
		axe, sim, works, blocked bool
		want                     int
	}{
		{true, true, true, false, 0},
		{true, true, false, false, 2}, // present + booted but AXe can't load its frameworks
		{false, true, true, false, 2},
		{true, false, true, false, 2},
		{false, false, false, false, 2},
		// doctor is the gate the docs call "exit 0 = ready". An environment where
		// every device verb refuses (2+ booted, no --udid) or where AXe cannot take
		// the tap style xcui sends is NOT ready, however healthy the rest looks.
		{true, true, true, true, 2},
	}
	for _, c := range cases {
		if got := doctorExitCode(c.axe, c.sim, c.works, c.blocked); got != c.want {
			t.Errorf("doctorExitCode(%v,%v,%v,%v) = %d, want %d", c.axe, c.sim, c.works, c.blocked, got, c.want)
		}
	}
}

func TestSimLabel(t *testing.T) {
	// simctl names often already carry the OS version, so appending the runtime
	// verbatim produced "iPhone 17 (27) (iOS 27.0)".
	cases := []struct {
		in   bootedSim
		want string
	}{
		{bootedSim{Name: "iPhone 17 (27)", Runtime: "iOS 27.0"}, "iPhone 17 (27)"},
		{bootedSim{Name: "iPhone 17 (26.5)", Runtime: "iOS 26.5"}, "iPhone 17 (26.5)"},
		{bootedSim{Name: "iPhone Duo", Runtime: "iOS 27.1"}, "iPhone Duo (iOS 27.1)"},
		{bootedSim{Name: "iPad", Runtime: ""}, "iPad"},
	}
	for _, c := range cases {
		if got := simLabel(c.in); got != c.want {
			t.Errorf("simLabel(%+v) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestWaitConditionMet(t *testing.T) {
	roots, _ := parseDescribeUI([]byte(sampleTree))
	if !conditionMet(roots, waitCond{kind: waitForElement, id: "play.all"}) {
		t.Error("expected for-element play.all to be met")
	}
	if conditionMet(roots, waitCond{kind: waitForElement, id: "absent"}) {
		t.Error("absent element should not be met")
	}
	if !conditionMet(roots, waitCond{kind: waitGone, id: "absent"}) {
		t.Error("gone(absent) should be met")
	}
	if conditionMet(roots, waitCond{kind: waitGone, id: "play.all"}) {
		t.Error("gone(present) should not be met")
	}
}

func TestEvaluateAssertPass(t *testing.T) {
	roots, _ := parseDescribeUI([]byte(sampleTree))
	res := evaluateAssert(roots, assertSpec{
		id: "artist.hero", label: "Artwork for The Chemical Brothers", hasLabel: true,
		trait: "image", single: true,
	})
	if !res.Pass {
		t.Errorf("expected pass, failures: %v", res.Failures)
	}
}

func TestEvaluateAssertLabelMismatch(t *testing.T) {
	roots, _ := parseDescribeUI([]byte(sampleTree))
	res := evaluateAssert(roots, assertSpec{id: "play.all", label: "Wrong", hasLabel: true})
	if res.Pass || len(res.Failures) == 0 {
		t.Error("expected failure on label mismatch")
	}
}

func TestEvaluateAssertSingleViolated(t *testing.T) {
	// two elements sharing an id → --single must fail
	dup := `[{"AXUniqueId":"dup","AXLabel":"a","role":"AXButton","type":"Button","enabled":true,"frame":{"x":0,"y":0,"width":1,"height":1},"children":[
	         {"AXUniqueId":"dup","AXLabel":"b","role":"AXButton","type":"Button","enabled":true,"frame":{"x":0,"y":0,"width":1,"height":1},"children":[]}]}]`
	roots, _ := parseDescribeUI([]byte(dup))
	res := evaluateAssert(roots, assertSpec{id: "dup", single: true})
	if res.Pass {
		t.Error("expected --single failure when id matches 2 elements")
	}
}

func TestEvaluateAssertNotFound(t *testing.T) {
	roots, _ := parseDescribeUI([]byte(sampleTree))
	res := evaluateAssert(roots, assertSpec{id: "ghost", label: "x", hasLabel: true})
	if res.Pass {
		t.Error("expected failure when element not found")
	}
}

func TestToggleLookup(t *testing.T) {
	tg, ok := lookupToggle("reduce-motion")
	if !ok {
		t.Fatal("reduce-motion should be known")
	}
	if tg.method != methodDefaults || tg.key == "" {
		t.Errorf("unexpected toggle spec: %+v", tg)
	}
	if _, ok := lookupToggle("bogus"); ok {
		t.Error("bogus toggle should be unknown")
	}
}

func TestToggleLookupNativeUI(t *testing.T) {
	if tg, ok := lookupToggle("increase-contrast"); !ok || tg.method != methodIncreaseContrast {
		t.Errorf("increase-contrast should map to methodIncreaseContrast, got %+v ok=%v", tg, ok)
	}
	if tg, ok := lookupToggle("dynamic-type"); !ok || tg.method != methodContentSize {
		t.Errorf("dynamic-type should map to methodContentSize, got %+v ok=%v", tg, ok)
	}
}

func TestParseOnOff(t *testing.T) {
	for _, s := range []string{"on", "true", "1", "yes"} {
		if v, err := parseOnOff(s); err != nil || !v {
			t.Errorf("parseOnOff(%q) = %v,%v", s, v, err)
		}
	}
	for _, s := range []string{"off", "false", "0", "no"} {
		if v, err := parseOnOff(s); err != nil || v {
			t.Errorf("parseOnOff(%q) = %v,%v", s, v, err)
		}
	}
	if _, err := parseOnOff("maybe"); err == nil {
		t.Error("expected error for invalid value")
	}
}

func TestContrastArg(t *testing.T) {
	if contrastArg(true) != "enabled" {
		t.Error("true should map to enabled")
	}
	if contrastArg(false) != "disabled" {
		t.Error("false should map to disabled")
	}
}
