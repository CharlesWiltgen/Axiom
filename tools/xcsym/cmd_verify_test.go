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

// writeCrashFixture builds a minimal IPS v1 JSON file referencing a known
// binary on disk (/bin/ls). Returns the path and the real UUID that was
// embedded into it.
func writeCrashFixture(t *testing.T) (path, uuid, arch string) {
	t.Helper()
	if _, err := exec.LookPath("xcrun"); err != nil {
		t.Skip("xcrun not available")
	}
	uuids, err := ReadUUIDs(context.Background(), "/bin/ls")
	if err != nil || len(uuids) == 0 {
		t.Skipf("cannot read /bin/ls uuids: %v", err)
	}
	uuid = uuids[0].UUID
	arch = uuids[0].Arch

	fixture := map[string]any{
		"bug_type": "309",
		"usedImages": []map[string]any{
			{"uuid": uuid, "name": "ls", "path": "/bin/ls", "arch": arch, "base": 0, "size": 0},
		},
	}
	data, err := json.Marshal(fixture)
	if err != nil {
		t.Fatal(err)
	}
	path = filepath.Join(t.TempDir(), "fixture.ips")
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatal(err)
	}
	return path, uuid, arch
}

func TestRunVerify_UsageErrors(t *testing.T) {
	// Missing filename
	var buf bytes.Buffer
	code := runVerify(&buf, []string{})
	if code != 1 {
		t.Errorf("no args: got exit %d, want 1", code)
	}
	// Too many
	code = runVerify(&buf, []string{"a.ips", "b.ips"})
	if code != 1 {
		t.Errorf("extra args: got exit %d, want 1", code)
	}
}

func TestRunVerify_InputNotFound(t *testing.T) {
	var buf bytes.Buffer
	code := runVerify(&buf, []string{"/nonexistent/crash.ips"})
	if code != 2 {
		t.Errorf("missing input: got exit %d, want 2", code)
	}
}

func TestRunVerify_UnsupportedFormat(t *testing.T) {
	path := filepath.Join(t.TempDir(), "garbage.txt")
	os.WriteFile(path, []byte("not a crash report"), 0o644)
	var buf bytes.Buffer
	code := runVerify(&buf, []string{path})
	if code != 2 {
		t.Errorf("unsupported format: got exit %d, want 2", code)
	}
}

func TestRunVerify_AllMatched(t *testing.T) {
	path, _, _ := writeCrashFixture(t)
	var buf bytes.Buffer
	code := runVerify(&buf, []string{"--dsym", "/bin/ls", "--no-cache", "--no-spotlight", path})
	if code != 0 {
		t.Fatalf("got exit %d, want 0\nstdout:\n%s", code, buf.String())
	}
	var out verifyOutput
	if err := json.Unmarshal(buf.Bytes(), &out); err != nil {
		t.Fatalf("json: %v\n%s", err, buf.String())
	}
	if out.Category != "all_matched" {
		t.Errorf("Category = %q, want all_matched", out.Category)
	}
	if len(out.Images.Matched) != 1 {
		t.Errorf("Matched = %+v, want 1", out.Images.Matched)
	}
	if out.Input.Format != FormatIPSv1 {
		t.Errorf("Input.Format = %q, want %q", out.Input.Format, FormatIPSv1)
	}
}

func TestRunVerify_PartialMissing(t *testing.T) {
	// Fixture with an unknown UUID — no explicit override — should exit 7.
	path := filepath.Join(t.TempDir(), "phantom.ips")
	doc := `{"bug_type":"309","usedImages":[{"uuid":"00000000-0000-0000-0000-000000000000","name":"Phantom","arch":"arm64"}]}`
	os.WriteFile(path, []byte(doc), 0o644)

	var buf bytes.Buffer
	code := runVerify(&buf, []string{"--no-cache", "--no-spotlight", path})
	if code != 7 {
		t.Fatalf("got exit %d, want 7 (partial/missing)\n%s", code, buf.String())
	}
	if !strings.Contains(buf.String(), `"category": "partial"`) {
		t.Errorf("expected category=partial in output, got:\n%s", buf.String())
	}
}
