package main

import "testing"

func TestAnnounceImage(t *testing.T) {
	roots, _ := parseDescribeUI([]byte(sampleTree))
	img := findByID(roots, "artist.hero")[0]
	if got := announce(img); got != "Artwork for The Chemical Brothers, image" {
		t.Errorf("announce = %q", got)
	}
}

func TestAnnounceButton(t *testing.T) {
	roots, _ := parseDescribeUI([]byte(sampleTree))
	btn := findByID(roots, "play.all")[0]
	if got := announce(btn); got != "Play all, button" {
		t.Errorf("announce = %q", got)
	}
}

func TestAnnounceValueBeforeTrait(t *testing.T) {
	// VoiceOver speaks label, then value, then trait.
	slider := `[{"AXUniqueId":"vol","AXLabel":"Volume","AXValue":"50%","role":"AXSlider","type":"Slider","enabled":true,"frame":{"x":0,"y":0,"width":100,"height":20},"children":[]}]`
	roots, _ := parseDescribeUI([]byte(slider))
	if got := announce(roots[0]); got != "Volume, 50%, adjustable" {
		t.Errorf("announce = %q, want %q", got, "Volume, 50%, adjustable")
	}
}

func TestAnnounceDimmed(t *testing.T) {
	disabled := `[{"AXUniqueId":"x","AXLabel":"Submit","role":"AXButton","type":"Button","enabled":false,"frame":{"x":0,"y":0,"width":1,"height":1},"children":[]}]`
	roots, _ := parseDescribeUI([]byte(disabled))
	if got := announce(roots[0]); got != "Submit, button, dimmed" {
		t.Errorf("announce = %q, want %q", got, "Submit, button, dimmed")
	}
}

func TestAnnounceStaticTextHasNoTrait(t *testing.T) {
	txt := `[{"AXUniqueId":"t","AXLabel":"Hello","role":"AXStaticText","type":"StaticText","enabled":true,"frame":{"x":0,"y":0,"width":1,"height":1},"children":[]}]`
	roots, _ := parseDescribeUI([]byte(txt))
	if got := announce(roots[0]); got != "Hello" {
		t.Errorf("announce = %q, want %q", got, "Hello")
	}
}

func TestAnnouncementSequence(t *testing.T) {
	roots, _ := parseDescribeUI([]byte(sampleTree))
	got := announcementSequence(roots)
	want := []string{
		"Artwork for The Chemical Brothers, image",
		"Play all, button",
	}
	if !equalStrings(got, want) {
		t.Errorf("sequence = %v, want %v", got, want)
	}
}

func TestTraverseOrderTopToBottomLeadingToTrailing(t *testing.T) {
	// Declared out of visual order: bottom-left, then two on the top row
	// (trailing before leading). Focus order must be top row L→R, then bottom.
	tree := `[{"AXUniqueId":null,"AXLabel":"App","role":"AXApplication","type":"Application","enabled":true,"frame":{"x":0,"y":0,"width":400,"height":800},"children":[
	  {"AXUniqueId":"bottom","AXLabel":"Bottom","role":"AXStaticText","type":"StaticText","enabled":true,"frame":{"x":0,"y":200,"width":50,"height":20},"children":[]},
	  {"AXUniqueId":"top.right","AXLabel":"TopRight","role":"AXStaticText","type":"StaticText","enabled":true,"frame":{"x":300,"y":10,"width":50,"height":20},"children":[]},
	  {"AXUniqueId":"top.left","AXLabel":"TopLeft","role":"AXStaticText","type":"StaticText","enabled":true,"frame":{"x":10,"y":12,"width":50,"height":20},"children":[]}
	]}]`
	roots, _ := parseDescribeUI([]byte(tree))
	order := traverseOrder(roots)
	var ids []string
	for _, el := range order {
		ids = append(ids, deref(el.AXUniqueID))
	}
	want := []string{"top.left", "top.right", "bottom"}
	if !equalStrings(ids, want) {
		t.Errorf("focus order = %v, want %v", ids, want)
	}
}

func TestTraverseOrderExcludesContainers(t *testing.T) {
	roots, _ := parseDescribeUI([]byte(sampleTree))
	for _, el := range traverseOrder(roots) {
		if el.Type == "Application" {
			t.Error("application container should not be focusable")
		}
	}
}

func TestParseExpectedSequenceBareArray(t *testing.T) {
	got, err := parseExpectedSequence([]byte(`["a","b","c"]`))
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !equalStrings(got, []string{"a", "b", "c"}) {
		t.Errorf("got %v", got)
	}
}

func TestParseExpectedSequenceReportObject(t *testing.T) {
	// A saved `voiceover traverse` report round-trips into assert.
	obj := `{"tool":"xcui","version":"x","action":"traverse","count":2,"sequence":["a","b"]}`
	got, err := parseExpectedSequence([]byte(obj))
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !equalStrings(got, []string{"a", "b"}) {
		t.Errorf("got %v", got)
	}
}

func TestCompareSequenceEqual(t *testing.T) {
	if f := compareSequence([]string{"a", "b"}, []string{"a", "b"}); len(f) != 0 {
		t.Errorf("expected no failures, got %v", f)
	}
}

func TestCompareSequenceElementMismatch(t *testing.T) {
	f := compareSequence([]string{"a", "x"}, []string{"a", "b"})
	if len(f) != 1 {
		t.Fatalf("expected 1 failure, got %v", f)
	}
}

func TestCompareSequenceLengthMismatch(t *testing.T) {
	if f := compareSequence([]string{"a"}, []string{"a", "b"}); len(f) == 0 {
		t.Error("expected a length-mismatch failure")
	}
}
