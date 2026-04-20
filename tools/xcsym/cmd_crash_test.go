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

func TestRunCrash_UnsupportedFormat(t *testing.T) {
	// A readable file that is neither .ips nor MetricKit — DetectFormat
	// returns FormatUnknown and parseByFormat falls through to the
	// "unsupported or unrecognized crash format" error path. Exit code
	// must be 2 (shared with other "unreadable/unsupported input" cases)
	// AND a structured JSON reject must land on stdout so agents can
	// route on `error` without scraping stderr.
	path := filepath.Join(t.TempDir(), "garbage.txt")
	if err := os.WriteFile(path, []byte("not a crash report"), 0o644); err != nil {
		t.Fatal(err)
	}
	var buf bytes.Buffer
	code := runCrash(&buf, []string{"--no-cache", "--no-spotlight", "--no-symbolicate", path})
	if code != 2 {
		t.Fatalf("unsupported format: code = %d, want 2\n%s", code, buf.String())
	}
	var reject crashRejectPayload
	if err := json.Unmarshal(buf.Bytes(), &reject); err != nil {
		t.Fatalf("json: %v\n%s", err, buf.String())
	}
	if reject.Error != "unsupported_format" {
		t.Errorf("error = %q, want unsupported_format", reject.Error)
	}
	if reject.Tool != "xcsym" {
		t.Errorf("tool = %q, want xcsym", reject.Tool)
	}
	if reject.Input != path {
		t.Errorf("input = %q, want %q", reject.Input, path)
	}
	if reject.Message == "" {
		t.Error("message should not be empty")
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
	// to stdout. Uses the existing swift_forced_unwrap fixture; its main
	// dSYM UUID (AABBCCDD-…) isn't on any CI system so verify should return
	// "Missing" and crashExitCode should choose 2 (main binary missing).
	// Asserting the exit code catches regressions that might silently flip
	// to 8 (write error) while the payload still lands on disk.
	outPath := filepath.Join(t.TempDir(), "report.json")
	var buf bytes.Buffer
	code := runCrash(&buf, []string{
		"--no-cache", "--no-spotlight", "--no-symbolicate",
		"--output", outPath,
		"testdata/crashes/ips_v2/swift_forced_unwrap.ips",
	})
	if code != 2 {
		t.Errorf("expected exit 2 (main binary missing), got %d", code)
	}
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
	// Re-parse the emitted JSON to guard against malformed output.
	var rep CrashReport
	if err := json.Unmarshal(data, &rep); err != nil {
		t.Fatalf("output file not valid CrashReport JSON: %v", err)
	}
	if rep.Crash.PatternRuleID != "R-swift-unwrap-01" {
		t.Errorf("pattern_rule_id = %q", rep.Crash.PatternRuleID)
	}
}

func TestRunCrash_AppleCrashText_EndToEnd(t *testing.T) {
	// Drive the committed .crash fixture through the crash subcommand.
	// The exit code is not asserted here because it varies per host:
	//   - CI / most dev machines: no dSYMs for the fixture's UUIDs → exit 2
	//   - A dev machine that happens to have the Poppy archive: main
	//     matches but most system-framework dSYMs don't → exit 7
	//   - A machine with every system dSYM pre-downloaded: exit 0
	// The test's real job is confirming the pipeline ran end-to-end
	// (parse → verify → categorize → format) on the legacy text format.
	// We verify that by parsing the JSON output and asserting field
	// values the pipeline would have had to set correctly to get here.
	var buf bytes.Buffer
	code := runCrash(&buf, []string{
		"--no-cache", "--no-spotlight", "--no-symbolicate",
		"--format=summary",
		"testdata/crashes/apple_crash/objc_exception_sigabrt.crash",
	})
	// Any symbolication-class exit is fine (0/2/3/4/7). A 1 would mean
	// usage error, 5 a tool error, 8 an output error — those shouldn't
	// happen here.
	switch code {
	case 0, 2, 3, 4, 7:
	default:
		t.Fatalf(".crash pipeline: unexpected code = %d\nstdout:\n%s", code, buf.String())
	}
	var report CrashReport
	if err := json.Unmarshal(buf.Bytes(), &report); err != nil {
		t.Fatalf("json: %v\n%s", err, buf.String())
	}
	if report.Input.Format != FormatAppleCrash {
		t.Errorf("Input.Format = %q, want %q", report.Input.Format, FormatAppleCrash)
	}
	if report.Crash.PatternRuleID != "R-objc-exc-01" {
		t.Errorf("PatternRuleID = %q, want R-objc-exc-01", report.Crash.PatternRuleID)
	}
	if report.Crash.Exception.Type != "EXC_CRASH" {
		t.Errorf("Exception.Type = %q, want EXC_CRASH", report.Crash.Exception.Type)
	}
	if report.Crash.Exception.Signal != "SIGABRT" {
		t.Errorf("Exception.Signal = %q, want SIGABRT", report.Crash.Exception.Signal)
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

