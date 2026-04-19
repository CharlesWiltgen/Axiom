package main

import (
	"context"
	"os/exec"
	"testing"
)

func TestReadUUIDs_ParsesOutput(t *testing.T) {
	sample := `UUID: 4C4C44EF-5555-3144-A1B5-0562264D518F (arm64) /path/to/MyApp
UUID: ABCDEF01-2345-6789-ABCD-EF0123456789 (arm64e) /path/to/MyApp
`
	got := parseDwarfdumpUUIDs([]byte(sample))
	if len(got) != 2 {
		t.Fatalf("expected 2 UUIDs, got %d", len(got))
	}
	if got[0].UUID != "4C4C44EF-5555-3144-A1B5-0562264D518F" {
		t.Errorf("UUID 0: got %q", got[0].UUID)
	}
	if got[0].Arch != "arm64" {
		t.Errorf("arch 0: got %q", got[0].Arch)
	}
	if got[1].Arch != "arm64e" {
		t.Errorf("arch 1: got %q", got[1].Arch)
	}
}

func TestReadUUIDs_RealBinary(t *testing.T) {
	if _, err := exec.LookPath("xcrun"); err != nil {
		t.Skip("xcrun not available")
	}
	uuids, err := ReadUUIDs(context.Background(), "/bin/ls")
	if err != nil {
		t.Fatalf("ReadUUIDs(/bin/ls): %v", err)
	}
	if len(uuids) == 0 {
		t.Error("expected at least one UUID from /bin/ls")
	}
}

func TestNormalizeUUID(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"4c4c44ef-5555-3144-a1b5-0562264d518f", "4C4C44EF-5555-3144-A1B5-0562264D518F"},
		{"4C4C44EF55553144A1B50562264D518F", "4C4C44EF-5555-3144-A1B5-0562264D518F"},
		{"4c4c44ef55553144a1b50562264d518f", "4C4C44EF-5555-3144-A1B5-0562264D518F"},
		// malformed passthrough (upper-cased but otherwise untouched so callers can error on them)
		{"4c4c44ef555531 44a1b50562264d518f", "4C4C44EF555531 44A1B50562264D518F"},
		{"not-a-uuid", "NOT-A-UUID"},
	}
	for _, c := range cases {
		if got := NormalizeUUID(c.in); got != c.want {
			t.Errorf("NormalizeUUID(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
