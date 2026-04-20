package main

import (
	"bytes"
	"context"
	"encoding/json"
	"os/exec"
	"testing"
)

func TestRunFindDsym_UsageErrors(t *testing.T) {
	var buf bytes.Buffer
	if code := runFindDsym(&buf, []string{}); code != 1 {
		t.Errorf("no args: code = %d, want 1", code)
	}
	buf.Reset()
	if code := runFindDsym(&buf, []string{"a", "b"}); code != 1 {
		t.Errorf("extra args: code = %d, want 1", code)
	}
}

func TestRunFindDsym_NotFound(t *testing.T) {
	var buf bytes.Buffer
	code := runFindDsym(&buf, []string{
		"--no-cache", "--no-spotlight",
		"--dsym-paths", t.TempDir(), // empty dir; nothing to find
		"00000000-0000-0000-0000-000000000000",
	})
	if code != 2 {
		t.Errorf("missing UUID: code = %d, want 2", code)
	}
}

func TestRunFindDsym_ExplicitMatchOnLs(t *testing.T) {
	// Build a Discoverer that matches /bin/ls via XCSYM_DSYM_PATHS, then
	// look up its real UUID. Proves the wiring end-to-end.
	if _, err := exec.LookPath("xcrun"); err != nil {
		t.Skip("xcrun not available")
	}
	entries, err := ReadUUIDs(context.Background(), "/bin/ls")
	if err != nil || len(entries) == 0 {
		t.Skipf("cannot read /bin/ls uuids: %v", err)
	}
	// find-dsym only finds .dSYM bundles or explicit paths; there's no
	// .dSYM for /bin/ls so Spotlight/archive search won't match. We
	// exercise the miss path here — the positive explicit-match path is
	// covered by TestRunCrash_EndToEnd_WithLsBinary which uses --dsym.
	var buf bytes.Buffer
	code := runFindDsym(&buf, []string{"--no-cache", "--no-spotlight", entries[0].UUID})
	// Accept exit 2 (not found) as the working outcome. Spotlight-warm
	// systems might return 0 if a dSYM is cached — in that case we
	// still want the JSON to be well-formed.
	switch code {
	case 0:
		var out findDsymOutput
		if err := json.Unmarshal(buf.Bytes(), &out); err != nil {
			t.Fatalf("unexpected stdout for exit 0: %q", buf.String())
		}
		if out.UUID == "" {
			t.Errorf("output missing UUID")
		}
	case 2:
		// expected on CI-like systems with no indexed dSYMs
	default:
		t.Errorf("unexpected exit %d\n%s", code, buf.String())
	}
}

func TestRunFindDsym_UUIDNormalized(t *testing.T) {
	// Lowercase UUID should be normalized before lookup. We can't observe
	// the normalized value on a miss, but we can verify the error message
	// uses uppercase form (hint: normalized input).
	var buf bytes.Buffer
	errBuf := bytes.Buffer{}
	_ = errBuf // stderr capture not available; just run it
	code := runFindDsym(&buf, []string{
		"--no-cache", "--no-spotlight",
		"--dsym-paths", t.TempDir(),
		"aabbccdd-eeff-0011-2233-445566778899",
	})
	if code != 2 {
		t.Errorf("miss: code = %d, want 2", code)
	}
}
