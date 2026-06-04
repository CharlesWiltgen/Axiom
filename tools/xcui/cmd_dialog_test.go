package main

import "testing"

// permissionAlert is a camera-permission dialog: an alert container with the
// standard two-button "Don't Allow" / "Allow" layout (straight apostrophe).
const permissionAlert = `[
  {
    "AXUniqueId": null, "AXLabel": "App", "role": "AXApplication", "type": "Application",
    "enabled": true, "frame": {"x":0,"y":0,"width":402,"height":874},
    "children": [
      {
        "AXUniqueId": null, "AXLabel": "“App” Would Like to Access the Camera",
        "role": "AXSheet", "type": "Alert", "enabled": true,
        "frame": {"x":51,"y":337,"width":300,"height":200},
        "children": [
          {"AXUniqueId": null, "AXLabel": "Don't Allow", "role": "AXButton", "type": "Button",
           "enabled": true, "frame": {"x":51,"y":480,"width":150,"height":44}, "children": []},
          {"AXUniqueId": "allow.btn", "AXLabel": "Allow", "role": "AXButton", "type": "Button",
           "enabled": true, "frame": {"x":201,"y":480,"width":150,"height":44}, "children": []}
        ]
      }
    ]
  }
]`

// locationAlert offers the three-way location choice; accept must prefer the
// most-permissive standard label that is present.
const locationAlert = `[
  {"AXUniqueId": null, "role": "AXSheet", "type": "Alert", "enabled": true,
   "frame": {"x":51,"y":337,"width":300,"height":260}, "children": [
    {"AXUniqueId": null, "AXLabel": "Allow Once", "role": "AXButton", "type": "Button",
     "enabled": true, "frame": {"x":51,"y":440,"width":300,"height":44}, "children": []},
    {"AXUniqueId": null, "AXLabel": "Allow While Using App", "role": "AXButton", "type": "Button",
     "enabled": true, "frame": {"x":51,"y":490,"width":300,"height":44}, "children": []},
    {"AXUniqueId": null, "AXLabel": "Don’t Allow", "role": "AXButton", "type": "Button",
     "enabled": true, "frame": {"x":51,"y":540,"width":300,"height":44}, "children": []}
  ]}
]`

// okAlert is a single-button informational alert.
const okAlert = `[
  {"AXUniqueId": null, "role": "AXSheet", "type": "Alert", "enabled": true,
   "frame": {"x":51,"y":337,"width":300,"height":150}, "children": [
    {"AXUniqueId": null, "AXLabel": "OK", "role": "AXButton", "type": "Button",
     "enabled": true, "frame": {"x":51,"y":440,"width":300,"height":44}, "children": []}
  ]}
]`

func TestFindAlertButtonAccept(t *testing.T) {
	roots, _ := parseDescribeUI([]byte(permissionAlert))
	btn, ok := findAlertButton(roots, intentAccept)
	if !ok {
		t.Fatal("expected to find an accept button")
	}
	if got := deref(btn.AXLabel); got != "Allow" {
		t.Errorf("accept button = %q, want %q", got, "Allow")
	}
}

func TestFindAlertButtonDismiss(t *testing.T) {
	roots, _ := parseDescribeUI([]byte(permissionAlert))
	btn, ok := findAlertButton(roots, intentDismiss)
	if !ok {
		t.Fatal("expected to find a dismiss button")
	}
	if got := deref(btn.AXLabel); got != "Don't Allow" {
		t.Errorf("dismiss button = %q, want %q", got, "Don't Allow")
	}
}

func TestFindAlertButtonDismissCurlyApostrophe(t *testing.T) {
	roots, _ := parseDescribeUI([]byte(locationAlert))
	btn, ok := findAlertButton(roots, intentDismiss)
	if !ok {
		t.Fatal("expected to match Don’t Allow with a curly apostrophe")
	}
	if got := deref(btn.AXLabel); got != "Don’t Allow" {
		t.Errorf("dismiss button = %q, want the curly-apostrophe variant", got)
	}
}

func TestFindAlertButtonAcceptPrefersMostPermissive(t *testing.T) {
	roots, _ := parseDescribeUI([]byte(locationAlert))
	btn, _ := findAlertButton(roots, intentAccept)
	if got := deref(btn.AXLabel); got != "Allow While Using App" {
		t.Errorf("accept button = %q, want %q (highest-preference present)", got, "Allow While Using App")
	}
}

func TestFindAlertButtonSingleButtonAlert(t *testing.T) {
	roots, _ := parseDescribeUI([]byte(okAlert))
	// A one-button alert taps its only button for either intent.
	for _, intent := range []alertIntent{intentAccept, intentDismiss} {
		btn, ok := findAlertButton(roots, intent)
		if !ok || deref(btn.AXLabel) != "OK" {
			t.Errorf("intent %v: got (%q,%v), want (OK,true)", intent, deref(btn.AXLabel), ok)
		}
	}
}

func TestFindAlertButtonNoAlert(t *testing.T) {
	// sampleTree (from main_test.go) has a "Play all" button but no alert and
	// no standard alert-button labels, so neither intent resolves.
	roots, _ := parseDescribeUI([]byte(sampleTree))
	if _, ok := findAlertButton(roots, intentAccept); ok {
		t.Error("expected no accept button on a normal screen")
	}
	if _, ok := findAlertButton(roots, intentDismiss); ok {
		t.Error("expected no dismiss button on a normal screen")
	}
}

func TestParseIntent(t *testing.T) {
	if i, ok := parseIntent("accept"); !ok || i != intentAccept {
		t.Errorf("accept => (%v,%v)", i, ok)
	}
	if i, ok := parseIntent("dismiss"); !ok || i != intentDismiss {
		t.Errorf("dismiss => (%v,%v)", i, ok)
	}
	if _, ok := parseIntent("maybe"); ok {
		t.Error("maybe should be rejected")
	}
}

func TestTapArgsPrefersID(t *testing.T) {
	roots, _ := parseDescribeUI([]byte(permissionAlert))
	btn, _ := findAlertButton(roots, intentAccept) // "Allow" has AXUniqueId allow.btn
	got := tapArgs(btn, "UDID1")
	want := []string{"tap", "--id", "allow.btn", "--udid", "UDID1"}
	if !equalStrings(got, want) {
		t.Errorf("tapArgs = %v, want %v", got, want)
	}
}

func TestTapArgsFallsBackToLabel(t *testing.T) {
	roots, _ := parseDescribeUI([]byte(permissionAlert))
	btn, _ := findAlertButton(roots, intentDismiss) // "Don't Allow", no AXUniqueId
	got := tapArgs(btn, "UDID1")
	want := []string{"tap", "--label", "Don't Allow", "--udid", "UDID1"}
	if !equalStrings(got, want) {
		t.Errorf("tapArgs = %v, want %v", got, want)
	}
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
