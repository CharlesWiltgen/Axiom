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

func TestDoctorExitCode(t *testing.T) {
	cases := []struct {
		axe, sim bool
		want     int
	}{
		{true, true, 0},
		{false, true, 2},
		{true, false, 2},
		{false, false, 2},
	}
	for _, c := range cases {
		if got := doctorExitCode(c.axe, c.sim); got != c.want {
			t.Errorf("doctorExitCode(%v,%v) = %d, want %d", c.axe, c.sim, got, c.want)
		}
	}
}
