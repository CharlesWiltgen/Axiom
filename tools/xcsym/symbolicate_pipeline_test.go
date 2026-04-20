package main

import (
	"context"
	"errors"
	"strings"
	"testing"
)

// TestBuildFrameGroups_NameCollisionKeepsFramesSeparate guards axiom-mv5.
// When two UsedImages share a Name (multi-framework copies, or MetricKit
// where binaryName can repeat across distinct UUIDs), the legacy name-keyed
// grouping silently collapsed frames onto the "last write wins" UsedImage —
// so frames got symbolicated against the wrong UUID/LoadAddress/Arch.
//
// With Frame.UUID populated at parse time and grouping keyed by UUID, each
// frame stays bound to its own image. The assertion fails if any frame leaks
// into a sibling group just because it shared a name.
func TestBuildFrameGroups_NameCollisionKeepsFramesSeparate(t *testing.T) {
	raw := &RawCrash{
		UsedImages: []UsedImage{
			{UUID: "AAAAAAAA-0000-0000-0000-000000000001", Name: "Foo", LoadAddress: 0x1000, Arch: "arm64"},
			{UUID: "BBBBBBBB-0000-0000-0000-000000000002", Name: "Foo", LoadAddress: 0x2000, Arch: "arm64"},
		},
		Threads: []Thread{{
			Index: 0,
			Frames: []Frame{
				{Index: 0, Address: "0x1100", Image: "Foo", UUID: "AAAAAAAA-0000-0000-0000-000000000001"},
				{Index: 1, Address: "0x2100", Image: "Foo", UUID: "BBBBBBBB-0000-0000-0000-000000000002"},
			},
		}},
		CrashedIdx: 0,
	}

	g := buildFrameGroups(raw, []int{0})

	if len(g.refs["AAAAAAAA-0000-0000-0000-000000000001"]) != 1 {
		t.Fatalf("AAAA group size = %d, want 1", len(g.refs["AAAAAAAA-0000-0000-0000-000000000001"]))
	}
	if len(g.refs["BBBBBBBB-0000-0000-0000-000000000002"]) != 1 {
		t.Fatalf("BBBB group size = %d, want 1", len(g.refs["BBBBBBBB-0000-0000-0000-000000000002"]))
	}
	if got := g.addrs["AAAAAAAA-0000-0000-0000-000000000001"][0]; got != "0x1100" {
		t.Errorf("AAAA addr = %q, want 0x1100 (would be 0x2100 if name-keyed lookup collided)", got)
	}
	if got := g.addrs["BBBBBBBB-0000-0000-0000-000000000002"][0]; got != "0x2100" {
		t.Errorf("BBBB addr = %q, want 0x2100 (would be 0x1100 if name-keyed lookup collided)", got)
	}
	if img := g.imagesByUUID["AAAAAAAA-0000-0000-0000-000000000001"]; img.LoadAddress != 0x1000 {
		t.Errorf("AAAA image.LoadAddress = 0x%x, want 0x1000", img.LoadAddress)
	}
	if img := g.imagesByUUID["BBBBBBBB-0000-0000-0000-000000000002"]; img.LoadAddress != 0x2000 {
		t.Errorf("BBBB image.LoadAddress = 0x%x, want 0x2000", img.LoadAddress)
	}
}

// TestBuildFrameGroups_SkipsWhenFrameUUIDEmpty: frames whose Image couldn't
// be resolved to a UsedImage at parse time (e.g. out-of-range imageIndex on
// kernel-stub frames) have empty UUID and must be skipped, not crashed on.
func TestBuildFrameGroups_SkipsWhenFrameUUIDEmpty(t *testing.T) {
	raw := &RawCrash{
		UsedImages: []UsedImage{
			{UUID: "AAAAAAAA-0000-0000-0000-000000000001", Name: "Foo", LoadAddress: 0x1000},
		},
		Threads: []Thread{{
			Index: 0,
			Frames: []Frame{
				{Index: 0, Address: "0x1100", Image: "Foo", UUID: "AAAAAAAA-0000-0000-0000-000000000001"},
				{Index: 1, Address: "0xdead", Image: "", UUID: ""}, // unresolved
			},
		}},
		CrashedIdx: 0,
	}
	g := buildFrameGroups(raw, []int{0})
	if len(g.refs) != 1 {
		t.Fatalf("groups = %d, want 1 (unresolved frame must be skipped)", len(g.refs))
	}
	if len(g.refs["AAAAAAAA-0000-0000-0000-000000000001"]) != 1 {
		t.Errorf("resolved group size = %d, want 1", len(g.refs["AAAAAAAA-0000-0000-0000-000000000001"]))
	}
}

// TestSymbolicateForTier_WarnsOnMissingDsym guards axiom-ogk. Previously
// SymbolicateForTier swallowed Find errors silently — the user saw
// "symbolicated": false on frames with no explanation. Now each miss
// produces a human-readable warning naming the image + UUID so the
// caller can thread it into CrashReport.Warnings.
func TestSymbolicateForTier_WarnsOnMissingDsym(t *testing.T) {
	raw := &RawCrash{
		UsedImages: []UsedImage{
			{UUID: "CAFEBABE-0000-0000-0000-000000000001", Name: "MyApp", LoadAddress: 0x1000, Arch: "arm64"},
		},
		Threads: []Thread{{
			Index:     0,
			Triggered: true,
			Frames: []Frame{
				{Index: 0, Address: "0x1100", Image: "MyApp", UUID: "CAFEBABE-0000-0000-0000-000000000001"},
				{Index: 1, Address: "0x1200", Image: "MyApp", UUID: "CAFEBABE-0000-0000-0000-000000000001"},
			},
		}},
		CrashedIdx: 0,
	}
	// Discoverer that can't find anything: no defaults, no cache, no user
	// paths. Every Find returns ErrNotFound.
	d := NewDiscoverer(DiscovererOptions{
		SkipDefaults:  true,
		SkipCache:     true,
		SkipSpotlight: true,
	})

	warnings := SymbolicateForTier(context.Background(), raw, ImageStatus{}, d, TierStandard)

	if len(warnings) != 1 {
		t.Fatalf("warnings = %d, want 1 (one image group, all unresolved)\ngot: %v", len(warnings), warnings)
	}
	w := warnings[0]
	if !strings.Contains(w, "MyApp") {
		t.Errorf("warning missing image name: %q", w)
	}
	if !strings.Contains(w, "CAFEBABE-0000-0000-0000-000000000001") {
		t.Errorf("warning missing UUID: %q", w)
	}
	if !strings.Contains(w, "dSYM not found") {
		t.Errorf("warning should name ErrNotFound case: %q", w)
	}
	if !strings.Contains(w, "2 frames") {
		t.Errorf("warning should report frame count: %q", w)
	}
	// Both frames stayed unsymbolicated.
	for i, f := range raw.Threads[0].Frames {
		if f.Symbolicated {
			t.Errorf("frame %d unexpectedly symbolicated", i)
		}
	}
}

// TestSymbolicateWarning_FormatsErrKinds checks the three branches
// (ErrNotFound, timeout, other) produce distinguishable messages so
// a reader can triage by reading the warning text.
func TestSymbolicateWarning_FormatsErrKinds(t *testing.T) {
	uuid := "AAAA-BBBB"
	cases := []struct {
		name string
		err  error
		want string
	}{
		{"not found", ErrNotFound, "dSYM not found"},
		{"not found wrapped", errors.New("wrap: " + ErrNotFound.Error()), ""}, // plain error, not wrapped with %w
		{"timeout", &TimeoutError{Cmd: "atos", Timeout: 0}, "timed out"},
		{"other", errors.New("disk full"), "failed (disk full)"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := symbolicateWarning(uuid, "MyApp", "discover", c.err, 3)
			if c.want == "" {
				// Just ensure it doesn't crash and mentions the image
				if !strings.Contains(w, "MyApp") {
					t.Errorf("missing image name: %q", w)
				}
				return
			}
			if !strings.Contains(w, c.want) {
				t.Errorf("warning %q missing %q", w, c.want)
			}
		})
	}
}

// TestBuildFrameGroups_SkipsPresymbolicatedAndEmptyAddress: both already-
// symbolicated frames and frames with missing addresses are no-ops for atos,
// so they must not appear in the grouping output.
func TestBuildFrameGroups_SkipsPresymbolicatedAndEmptyAddress(t *testing.T) {
	raw := &RawCrash{
		UsedImages: []UsedImage{
			{UUID: "AAAAAAAA-0000-0000-0000-000000000001", Name: "Foo", LoadAddress: 0x1000},
		},
		Threads: []Thread{{
			Index: 0,
			Frames: []Frame{
				{Index: 0, Address: "0x1100", Image: "Foo", UUID: "AAAAAAAA-0000-0000-0000-000000000001", Symbolicated: true},
				{Index: 1, Address: "", Image: "Foo", UUID: "AAAAAAAA-0000-0000-0000-000000000001"},
			},
		}},
		CrashedIdx: 0,
	}
	g := buildFrameGroups(raw, []int{0})
	if len(g.refs) != 0 {
		t.Errorf("groups = %d, want 0 (pre-symbolicated + empty-address frames skipped)", len(g.refs))
	}
}
