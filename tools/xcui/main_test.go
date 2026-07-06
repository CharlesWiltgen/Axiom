package main

import "testing"

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

// With more than one sim booted the candidates must come back sorted, so the
// pick is stable across runs (Go map iteration order is randomized — without
// sorting, wait/assert could target a different sim each run).
func TestBootedUDIDsSortedDeterministic(t *testing.T) {
	const twoBooted = `{"devices":{
	  "com.apple.CoreSimulator.SimRuntime.iOS-26-0":[
	    {"udid":"ZZZZ","state":"Booted","name":"iPhone 17 Pro"},
	    {"udid":"AAAA","state":"Booted","name":"iPhone 17"},
	    {"udid":"MMMM","state":"Shutdown","name":"iPad"}
	  ]}}`
	got, err := bootedUDIDs([]byte(twoBooted))
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !equalStrings(got, []string{"AAAA", "ZZZZ"}) {
		t.Errorf("bootedUDIDs = %v, want [AAAA ZZZZ] (sorted)", got)
	}
}

func TestBootedUDIDsNoneBooted(t *testing.T) {
	none := `{"devices":{"r":[{"udid":"AAAA","state":"Shutdown","name":"x"}]}}`
	got, err := bootedUDIDs([]byte(none))
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected no booted sims, got %v", got)
	}
}

func TestDoctorExitCode(t *testing.T) {
	cases := []struct {
		axe, sim, works bool
		want            int
	}{
		{true, true, true, 0},
		{true, true, false, 2}, // present + booted but AXe can't load its frameworks
		{false, true, true, 2},
		{true, false, true, 2},
		{false, false, false, 2},
	}
	for _, c := range cases {
		if got := doctorExitCode(c.axe, c.sim, c.works); got != c.want {
			t.Errorf("doctorExitCode(%v,%v,%v) = %d, want %d", c.axe, c.sim, c.works, got, c.want)
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
