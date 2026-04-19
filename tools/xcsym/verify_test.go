package main

import (
	"context"
	"os/exec"
	"testing"
)

func TestVerifyImages_AllMatch(t *testing.T) {
	if _, err := exec.LookPath("xcrun"); err != nil {
		t.Skip("xcrun not available")
	}
	uuids, err := ReadUUIDs(context.Background(), "/bin/ls")
	if err != nil || len(uuids) == 0 {
		t.Skipf("cannot read /bin/ls uuids: %v", err)
	}
	raw := &RawCrash{
		UsedImages: []UsedImage{{UUID: uuids[0].UUID, Name: "ls", Path: "/bin/ls", Arch: uuids[0].Arch}},
	}
	d := NewDiscoverer(DiscovererOptions{
		Explicit:      "/bin/ls",
		SkipSpotlight: true,
		SkipDefaults:  true,
	})
	status, err := VerifyImages(context.Background(), d, raw)
	if err != nil {
		t.Fatalf("VerifyImages: %v", err)
	}
	if len(status.Matched) != 1 {
		t.Errorf("Matched = %+v, want 1 entry", status.Matched)
	}
	if len(status.Missing) != 0 {
		t.Errorf("Missing = %+v, want empty", status.Missing)
	}
	if len(status.Mismatched) != 0 {
		t.Errorf("Mismatched = %+v, want empty", status.Mismatched)
	}
}

func TestVerifyImages_MissingDsym(t *testing.T) {
	raw := &RawCrash{
		UsedImages: []UsedImage{{UUID: "00000000-0000-0000-0000-000000000000", Name: "Phantom"}},
	}
	d := NewDiscoverer(DiscovererOptions{SkipSpotlight: true, SkipDefaults: true})
	status, err := VerifyImages(context.Background(), d, raw)
	if err != nil {
		t.Fatalf("VerifyImages: %v", err)
	}
	if len(status.Missing) != 1 {
		t.Fatalf("Missing = %+v, want 1 entry", status.Missing)
	}
	if status.Missing[0].Reason == "" {
		t.Error("Missing.Reason should explain where we looked")
	}
	if len(status.Matched) != 0 || len(status.Mismatched) != 0 {
		t.Errorf("unexpected non-missing entries: matched=%+v mismatched=%+v", status.Matched, status.Mismatched)
	}
}

func TestVerifyImages_EmptyUUIDIsSkipped(t *testing.T) {
	// Some parsers emit placeholder images with no UUID (e.g. MAIN, unknown frames).
	// Those should not show up as missing.
	raw := &RawCrash{
		UsedImages: []UsedImage{{Name: "???"}},
	}
	d := NewDiscoverer(DiscovererOptions{SkipSpotlight: true, SkipDefaults: true})
	status, err := VerifyImages(context.Background(), d, raw)
	if err != nil {
		t.Fatalf("VerifyImages: %v", err)
	}
	if len(status.Matched) != 0 || len(status.Missing) != 0 || len(status.Mismatched) != 0 {
		t.Errorf("expected all slices empty, got %+v", status)
	}
}

func TestVerifyImages_ArchMismatch(t *testing.T) {
	if _, err := exec.LookPath("xcrun"); err != nil {
		t.Skip("xcrun not available")
	}
	uuids, err := ReadUUIDs(context.Background(), "/bin/ls")
	if err != nil || len(uuids) == 0 {
		t.Skipf("cannot read /bin/ls uuids: %v", err)
	}
	realArch := uuids[0].Arch
	wrongArch := "armv7"
	if realArch == "armv7" {
		wrongArch = "arm64"
	}
	raw := &RawCrash{
		UsedImages: []UsedImage{{UUID: uuids[0].UUID, Name: "ls", Path: "/bin/ls", Arch: wrongArch}},
	}
	d := NewDiscoverer(DiscovererOptions{
		Explicit:      "/bin/ls",
		SkipSpotlight: true,
		SkipDefaults:  true,
	})
	status, err := VerifyImages(context.Background(), d, raw)
	if err != nil {
		t.Fatalf("VerifyImages: %v", err)
	}
	if len(status.Mismatched) != 1 {
		t.Fatalf("Mismatched = %+v, want 1 entry (requested %s, binary is %s)",
			status.Mismatched, wrongArch, realArch)
	}
	if status.Mismatched[0].Kind != MismatchArch {
		t.Errorf("Mismatched.Kind = %q, want %q", status.Mismatched[0].Kind, MismatchArch)
	}
}

func TestVerifyImages_UUIDMismatch(t *testing.T) {
	// Explicit --dsym points at /bin/ls, but the crash references a different UUID.
	if _, err := exec.LookPath("xcrun"); err != nil {
		t.Skip("xcrun not available")
	}
	raw := &RawCrash{
		UsedImages: []UsedImage{{UUID: "00000000-0000-0000-0000-000000000000", Name: "ls", Path: "/bin/ls", Arch: "arm64"}},
	}
	d := NewDiscoverer(DiscovererOptions{
		Explicit:      "/bin/ls",
		SkipSpotlight: true,
		SkipDefaults:  true,
	})
	status, err := VerifyImages(context.Background(), d, raw)
	if err != nil {
		t.Fatalf("VerifyImages: %v", err)
	}
	if len(status.Mismatched) != 1 {
		t.Fatalf("Mismatched = %+v, want 1 entry", status.Mismatched)
	}
	if status.Mismatched[0].Kind != MismatchUUID {
		t.Errorf("Mismatched.Kind = %q, want %q", status.Mismatched[0].Kind, MismatchUUID)
	}
}

func TestStatusCategory(t *testing.T) {
	tests := []struct {
		name string
		s    ImageStatus
		want string
	}{
		{"empty", ImageStatus{}, "all_matched"},
		{"all matched", ImageStatus{Matched: []ImageMatch{{UUID: "A"}}}, "all_matched"},
		{"uuid mismatch", ImageStatus{
			Mismatched: []ImageMatch{{UUID: "A", Kind: MismatchUUID}},
		}, "mismatch_uuid"},
		{"arch mismatch", ImageStatus{
			Mismatched: []ImageMatch{{UUID: "A", Kind: MismatchArch}},
		}, "mismatch_arch"},
		{"uuid wins over arch", ImageStatus{
			Mismatched: []ImageMatch{
				{UUID: "A", Kind: MismatchArch},
				{UUID: "B", Kind: MismatchUUID},
			},
		}, "mismatch_uuid"},
		{"miss beats mismatch", ImageStatus{
			Matched:    []ImageMatch{{UUID: "A"}},
			Mismatched: []ImageMatch{{UUID: "B", Kind: MismatchUUID}},
			Missing:    []ImageMiss{{UUID: "C"}},
		}, "partial"},
		{"all missing", ImageStatus{Missing: []ImageMiss{{UUID: "B"}}}, "partial"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := StatusCategory(tc.s); got != tc.want {
				t.Errorf("StatusCategory(%+v) = %q, want %q", tc.s, got, tc.want)
			}
		})
	}
}
