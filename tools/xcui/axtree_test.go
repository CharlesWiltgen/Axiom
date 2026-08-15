package main

import "testing"

func TestParseDescribeUIToleratesNonStringAXValue(t *testing.T) {
	// Reported from Poppy 2026-08-15: `xcui assert` died with
	// "cannot unmarshal number into Go struct field AXElement.AXValue of type
	// string". A single numeric AXValue anywhere on screen failed the WHOLE
	// document, so assert/wait/dialog/voiceover all broke together. Measured on a
	// stock Settings screen: 258 null, 10 string, 5 NUMBER — not an exotic control.
	cases := []struct {
		name string
		json string
		want string
	}{
		{"number (slider)", `[{"AXValue":0.5,"role":"AXSlider"}]`, "0.5"},
		{"integer (page control)", `[{"AXValue":3,"role":"AXPageControl"}]`, "3"},
		{"bool (toggle)", `[{"AXValue":true,"role":"AXSwitch"}]`, "true"},
		{"string (unchanged)", `[{"AXValue":"On","role":"AXSwitch"}]`, "On"},
		{"null stays absent", `[{"AXValue":null,"role":"AXGroup"}]`, ""},
		{"absent stays absent", `[{"role":"AXGroup"}]`, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			roots, err := parseDescribeUI([]byte(c.json))
			if err != nil {
				t.Fatalf("parse failed: %v", err)
			}
			if got := deref(roots[0].AXValue); got != c.want {
				t.Errorf("AXValue = %q, want %q", got, c.want)
			}
		})
	}
}

func TestNonStringToleranceCoversEveryTextField(t *testing.T) {
	// The cost of guessing wrong about ANY of these is total parse failure, so
	// every text-ish field is tolerant, not just the one that was reported.
	data := []byte(`[{"AXUniqueId":42,"AXLabel":7,"AXValue":0.5,"title":1,"help":2,"subrole":3,"role":"AXSlider"}]`)
	roots, err := parseDescribeUI(data)
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}
	el := roots[0]
	for field, got := range map[string]string{
		"AXUniqueId": deref(el.AXUniqueID), "AXLabel": deref(el.AXLabel),
		"AXValue": deref(el.AXValue), "title": deref(el.Title),
		"help": deref(el.Help), "subrole": deref(el.Subrole),
	} {
		if got == "" {
			t.Errorf("%s came back empty; a numeric value must survive as text", field)
		}
	}
}

func TestFindByIDMatchesNumericIdentifiers(t *testing.T) {
	// A numeric AXUniqueId must be findable by its literal text, and an empty
	// --id must not match elements that simply have no identifier.
	roots, err := parseDescribeUI([]byte(`[{"AXUniqueId":42,"role":"AXButton"},{"role":"AXGroup"}]`))
	if err != nil {
		t.Fatal(err)
	}
	if got := len(findByID(roots, "42")); got != 1 {
		t.Errorf("findByID(\"42\") matched %d, want 1", got)
	}
	if got := len(findByID(roots, "")); got != 0 {
		t.Errorf("empty id matched %d elements, want 0", got)
	}
}
