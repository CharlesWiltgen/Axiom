package main

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestCmdResolve_EmitsJSON(t *testing.T) {
	var out bytes.Buffer
	// Use /bin/ls as the "dSYM" — it's a Mach-O binary with a symbol table.
	code := runResolve(&out, []string{"--dsym", "/bin/ls", "--load-addr", "0x100000000", "0x100000000"})
	if code != 0 {
		t.Fatalf("exit code = %d, want 0. output: %s", code, out.String())
	}
	var result struct {
		Tool    string `json:"tool"`
		Results []struct {
			Address string `json:"address"`
			Raw     string `json:"raw"`
		} `json:"results"`
	}
	if err := json.Unmarshal(out.Bytes(), &result); err != nil {
		t.Fatalf("output not valid JSON: %v. output: %s", err, out.String())
	}
	if result.Tool != "xcsym" {
		t.Errorf("tool = %q, want xcsym", result.Tool)
	}
	if len(result.Results) != 1 {
		t.Errorf("expected 1 result, got %d", len(result.Results))
	}
}

func TestCmdResolve_MissingDsym(t *testing.T) {
	var out bytes.Buffer
	code := runResolve(&out, []string{"--dsym", "/nonexistent/path.dSYM", "--load-addr", "0x100000000", "0x100000000"})
	if code != 2 && code != 5 {
		t.Errorf("expected exit 2 (no dSYM) or 5 (tool error), got %d", code)
	}
}

func TestCmdResolve_MissingRequiredFlags(t *testing.T) {
	var out bytes.Buffer
	code := runResolve(&out, []string{"0x100000000"})
	if code != 1 {
		t.Errorf("expected exit 1 for missing flags, got %d", code)
	}
}

func TestCmdResolve_NoAddresses(t *testing.T) {
	var out bytes.Buffer
	code := runResolve(&out, []string{"--dsym", "/bin/ls", "--load-addr", "0x100000000"})
	if code != 1 {
		t.Errorf("expected exit 1 for missing addresses, got %d", code)
	}
}
