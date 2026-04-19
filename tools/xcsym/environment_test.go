package main

import (
	"context"
	"runtime"
	"testing"
)

func TestCaptureEnvironment_FillsFields(t *testing.T) {
	env, err := CaptureEnvironment(context.Background())
	if err != nil {
		t.Fatalf("CaptureEnvironment: %v", err)
	}
	if env.HostArch != runtime.GOARCH {
		t.Errorf("HostArch: got %q, want %q", env.HostArch, runtime.GOARCH)
	}
	if env.AtosVersion == "" {
		t.Log("atos_version empty — atos may not be installed on this host")
	}
	if env.XcodePath == "" {
		t.Log("xcode_path empty — xcode-select may not be configured")
	}
}

func TestIsCLTBelowMinimum(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"Command Line Tools for Xcode 14.0", true},
		{"Command Line Tools for Xcode 15.0", false},
		{"Command Line Tools for Xcode 16.2 (Build 16C5032a)", false},
		{"weird unknown version", false},
	}
	for _, c := range cases {
		if got := IsCLTBelowMinimum(c.in, 15); got != c.want {
			t.Errorf("IsCLTBelowMinimum(%q, 15) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestExtractCLTVersion(t *testing.T) {
	sample := `package-id: com.apple.pkg.CLTools_Executables
version: 15.3.0.0.1.1708646388
volume: /
location: /
install-time: 1711048391
`
	got := extractCLTVersion(sample)
	if got != "15.3.0.0.1.1708646388" {
		t.Errorf("extractCLTVersion got %q", got)
	}
}
