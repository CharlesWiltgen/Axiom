package main

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestRunCrash_UsageErrors(t *testing.T) {
	var buf bytes.Buffer
	if code := runCrash(&buf, []string{}); code != 1 {
		t.Errorf("no args: code = %d, want 1", code)
	}
	buf.Reset()
	if code := runCrash(&buf, []string{"a.ips", "b.ips"}); code != 1 {
		t.Errorf("extra args: code = %d, want 1", code)
	}
	buf.Reset()
	if code := runCrash(&buf, []string{"--format=giant", "some.ips"}); code != 1 {
		t.Errorf("bad tier: code = %d, want 1", code)
	}
}

func TestRunCrash_InputNotFound(t *testing.T) {
	var buf bytes.Buffer
	code := runCrash(&buf, []string{"--no-cache", "--no-spotlight", "--no-symbolicate",
		"/nonexistent/crash.ips"})
	if code != 2 {
		t.Errorf("missing input: code = %d, want 2", code)
	}
}

func TestRunCrash_HangRejected(t *testing.T) {
	var buf bytes.Buffer
	code := runCrash(&buf, []string{"--no-cache", "--no-spotlight", "--no-symbolicate",
		"testdata/crashes/ips_v2/hang.ips"})
	if code != 1 {
		t.Fatalf("hang: code = %d, want 1\n%s", code, buf.String())
	}
	var reject crashRejectPayload
	if err := json.Unmarshal(buf.Bytes(), &reject); err != nil {
		t.Fatalf("json: %v\n%s", err, buf.String())
	}
	if reject.Error != "hang_report" {
		t.Errorf("error = %q, want hang_report", reject.Error)
	}
	if !strings.Contains(reject.Message, "bug_type=298") {
		t.Errorf("message missing bug_type=298: %q", reject.Message)
	}
}

func TestRunCrash_NonFatalCPURejected(t *testing.T) {
	// Build a synthetic non-fatal CPU EXC_RESOURCE .ips on the fly.
	ips := `{"app_name":"MyApp","timestamp":"2026","bug_type":"309","os_version":"iOS 17.5","name":"MyApp"}
{"procName":"MyApp","cpuType":"ARM-64","exception":{"type":"EXC_RESOURCE","codes":"0x0, 0x0","subtype":"CPU (NON-FATAL)"},"termination":{"namespace":"RESOURCE","code":0},"faultingThread":0,"threads":[{"triggered":true,"frames":[{"imageOffset":1,"imageIndex":0}]}],"usedImages":[{"source":"P","arch":"arm64","base":1,"size":1,"uuid":"aabbccdd-eeff-0011-2233-445566778899","name":"MyApp","path":"/x"}]}
`
	path := filepath.Join(t.TempDir(), "cpu.ips")
	if err := os.WriteFile(path, []byte(ips), 0o644); err != nil {
		t.Fatal(err)
	}
	var buf bytes.Buffer
	code := runCrash(&buf, []string{"--no-cache", "--no-spotlight", "--no-symbolicate", path})
	if code != 1 {
		t.Fatalf("non-fatal CPU: code = %d, want 1\n%s", code, buf.String())
	}
	var reject crashRejectPayload
	if err := json.Unmarshal(buf.Bytes(), &reject); err != nil {
		t.Fatalf("json: %v\n%s", err, buf.String())
	}
	if reject.Error != "non_fatal_resource" {
		t.Errorf("error = %q, want non_fatal_resource", reject.Error)
	}
}

func TestRunCrash_EndToEnd_WithLsBinary(t *testing.T) {
	// Build a minimal IPS v1 crash pointing at /bin/ls so verify can
	// resolve the "app binary" via dwarfdump and symbolicate can call
	// atos against it. If xcrun isn't available, skip.
	if _, err := exec.LookPath("xcrun"); err != nil {
		t.Skip("xcrun not available")
	}
	uuids, err := ReadUUIDs(context.Background(), "/bin/ls")
	if err != nil || len(uuids) == 0 {
		t.Skipf("cannot read /bin/ls uuids: %v", err)
	}
	uuid, arch := uuids[0].UUID, uuids[0].Arch

	fixture := map[string]any{
		"app_name":  "ls",
		"bundle_id": "com.example.ls",
		"bug_type":  "309",
		"cpuType":   "ARM-64",
		"exception": map[string]any{
			"type":    "EXC_BREAKPOINT",
			"codes":   "0x1",
			"subtype": "Swift runtime failure: unexpectedly found nil while unwrapping an Optional value",
		},
		"termination":    map[string]any{"namespace": "SIGNAL", "code": 5},
		"faultingThread": 0,
		"threads": []any{
			map[string]any{
				"triggered": true,
				"frames":    []any{map[string]any{"imageOffset": 100, "imageIndex": 0}},
			},
		},
		"usedImages": []any{
			map[string]any{"uuid": uuid, "name": "ls", "path": "/bin/ls", "arch": arch, "base": 0, "size": 0},
		},
	}
	data, err := json.Marshal(fixture)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "crash.ips")
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer
	code := runCrash(&buf, []string{
		"--dsym", "/bin/ls",
		"--no-cache", "--no-spotlight",
		"--format=summary",
		path,
	})
	if code != 0 {
		t.Fatalf("e2e: code = %d, want 0\nstdout:\n%s", code, buf.String())
	}
	var report CrashReport
	if err := json.Unmarshal(buf.Bytes(), &report); err != nil {
		t.Fatalf("json: %v\n%s", err, buf.String())
	}
	if report.Format != TierSummary {
		t.Errorf("format = %q, want summary", report.Format)
	}
	if report.Crash.PatternRuleID != "R-swift-unwrap-01" {
		t.Errorf("pattern = %q, want R-swift-unwrap-01", report.Crash.PatternRuleID)
	}
	if report.ImagesSummary == nil || report.ImagesSummary.MatchedCount != 1 {
		t.Errorf("images_summary = %+v, want matched=1", report.ImagesSummary)
	}
}

func TestRunCrash_OutputFileFlag(t *testing.T) {
	// Verify --output writes to disk instead of stdout and doesn't duplicate
	// to stdout. Uses the existing swift_forced_unwrap fixture for simplicity;
	// the app binary won't resolve, so exit code will be non-zero, but that
	// isn't what we're testing — we're testing I/O routing.
	outPath := filepath.Join(t.TempDir(), "report.json")
	var buf bytes.Buffer
	_ = runCrash(&buf, []string{
		"--no-cache", "--no-spotlight", "--no-symbolicate",
		"--output", outPath,
		"testdata/crashes/ips_v2/swift_forced_unwrap.ips",
	})
	// stdout should be empty (payload went to file).
	if buf.Len() != 0 {
		t.Errorf("stdout should be empty when --output set, got %q", buf.String())
	}
	data, err := os.ReadFile(outPath)
	if err != nil {
		t.Fatalf("read output: %v", err)
	}
	if !bytes.Contains(data, []byte("R-swift-unwrap-01")) {
		t.Errorf("output file missing pattern_rule_id:\n%s", string(data))
	}
}

func TestRunCrash_ExitCode2_MainMissing(t *testing.T) {
	// Fabricate a crash whose "main binary" UUID we know is nowhere on the
	// system. Without --dsym override, verify should classify it as Missing
	// and crashExitCode should return 2.
	ips := `{"app_name":"Ghost","bundle_id":"com.example.ghost","bug_type":"309","cpuType":"ARM-64","exception":{"type":"EXC_BAD_ACCESS","codes":"0x1, 0x0","subtype":"KERN_INVALID_ADDRESS"},"faultingThread":0,"threads":[{"triggered":true,"frames":[{"imageOffset":1,"imageIndex":0}]}],"usedImages":[{"uuid":"00000000-0000-0000-0000-000000000000","name":"Ghost","arch":"arm64","base":0,"size":0}]}`
	path := filepath.Join(t.TempDir(), "ghost.ips")
	if err := os.WriteFile(path, []byte(ips), 0o644); err != nil {
		t.Fatal(err)
	}
	var buf bytes.Buffer
	code := runCrash(&buf, []string{
		"--no-cache", "--no-spotlight", "--no-symbolicate",
		path,
	})
	if code != 2 {
		t.Errorf("missing main binary: code = %d, want 2\n%s", code, buf.String())
	}
}

