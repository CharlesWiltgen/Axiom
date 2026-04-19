package main

import (
	"context"
	"os/exec"
	"testing"
)

func TestResolveSingle_StdlibSystemAddress(t *testing.T) {
	if _, err := exec.LookPath("atos"); err != nil {
		t.Skip("atos not available")
	}
	// Probe atos against /bin/ls directly to confirm the environment behaves.
	res, err := ExecRun(context.Background(), 0, "atos", "-o", "/bin/ls", "-l", "0x100000000", "0x100000000")
	if err != nil {
		t.Fatalf("atos probe: %v", err)
	}
	if len(res.Stdout) == 0 {
		t.Fatal("atos returned no output")
	}
	// Real test: our wrapper returns something for the same inputs.
	sym, err := ResolveSingle(context.Background(), "/bin/ls", "arm64", "0x100000000", "0x100000000")
	if err != nil {
		// /bin/ls may be arm64e on Apple Silicon; re-try without arch constraint.
		sym, err = ResolveSingle(context.Background(), "/bin/ls", "", "0x100000000", "0x100000000")
		if err != nil {
			t.Fatalf("ResolveSingle: %v", err)
		}
	}
	if sym.Raw == "" {
		t.Error("expected non-empty raw atos output")
	}
}

func TestResolveSingle_ParsesAtosOutput(t *testing.T) {
	cases := []struct {
		raw        string
		wantSymbol string
		wantFile   string
		wantLine   int
	}{
		{"ContentView.body.getter (in MyApp) (ContentView.swift:42)", "ContentView.body.getter", "ContentView.swift", 42},
		{"-[NSObject init] (in Foundation)", "-[NSObject init]", "", 0},
		{"0x1045a8b2c (in MyApp)", "", "", 0}, // unsymbolicated
		{"main (in ls) + 152", "main", "", 0},
	}
	for _, c := range cases {
		sym := parseAtosLine(c.raw)
		if sym.Symbol != c.wantSymbol {
			t.Errorf("parseAtosLine(%q) symbol = %q, want %q", c.raw, sym.Symbol, c.wantSymbol)
		}
		if sym.File != c.wantFile {
			t.Errorf("parseAtosLine(%q) file = %q, want %q", c.raw, sym.File, c.wantFile)
		}
		if sym.Line != c.wantLine {
			t.Errorf("parseAtosLine(%q) line = %d, want %d", c.raw, sym.Line, c.wantLine)
		}
	}
}
