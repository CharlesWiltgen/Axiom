package main

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// TestLabelRootsBySource guards axiom-h2s. When --source=all, each bundle's
// Source field must reflect the source-type bucket its root came from
// (archives/deriveddata/downloads/toolchain/frameworks/env), not the
// literal flag value "all".
func TestLabelRootsBySource(t *testing.T) {
	opts := DiscovererOptions{
		ArchivesPaths:    []string{"/archives/A"},
		DerivedDataPaths: []string{"/dd/X"},
		DownloadsPaths:   []string{"/dl/Y"},
		ToolchainPaths:   []string{"/tc/Z"},
		FrameworkRoots:   []string{"/fr/W"},
		UserPaths:        []string{"/env/V"},
		SkipDefaults:     true,
	}
	d := NewDiscoverer(opts)
	labels := labelRootsBySource(d, "all")
	cases := map[string]string{
		"/archives/A": "archives",
		"/dd/X":       "deriveddata",
		"/dl/Y":       "downloads",
		"/tc/Z":       "toolchain",
		"/fr/W":       "frameworks",
		"/env/V":      "env",
	}
	for root, want := range cases {
		if got := labels[root]; got != want {
			t.Errorf("labels[%q] = %q, want %q", root, got, want)
		}
	}
}

func TestRunListDsyms_UnknownSource(t *testing.T) {
	var buf bytes.Buffer
	if code := runListDsyms(&buf, []string{"--source=nonsense"}); code != 1 {
		t.Errorf("bad source: code = %d, want 1", code)
	}
}

func TestRunListDsyms_EmptyRootsProduceEmptyList(t *testing.T) {
	root := t.TempDir()
	var buf bytes.Buffer
	code := runListDsyms(&buf, []string{
		"--source=env",
		"--dsym-paths", root,
	})
	if code != 0 {
		t.Fatalf("empty dir: code = %d, want 0\n%s", code, buf.String())
	}
	var out listDsymsOutput
	if err := json.Unmarshal(buf.Bytes(), &out); err != nil {
		t.Fatalf("json: %v\n%s", err, buf.String())
	}
	if len(out.Bundles) != 0 {
		t.Errorf("bundles = %d, want 0", len(out.Bundles))
	}
	if len(out.Roots) != 1 || out.Roots[0] != root {
		t.Errorf("roots = %v, want [%s]", out.Roots, root)
	}
}

func TestRunListDsyms_FindsBundle(t *testing.T) {
	// Construct a fake .dSYM bundle wrapping /bin/ls so ReadUUIDs returns
	// real UUIDs. Then list-dsyms should find it via the --dsym-paths root.
	if _, err := exec.LookPath("xcrun"); err != nil {
		t.Skip("xcrun not available")
	}
	root := t.TempDir()
	bundle := filepath.Join(root, "Ls.dSYM")
	dwarf := filepath.Join(bundle, "Contents", "Resources", "DWARF")
	if err := os.MkdirAll(dwarf, 0o755); err != nil {
		t.Fatal(err)
	}
	// Copy /bin/ls into the DWARF directory so dwarfdump --uuid works.
	src, err := os.ReadFile("/bin/ls")
	if err != nil {
		t.Skipf("cannot read /bin/ls: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dwarf, "Ls"), src, 0o644); err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer
	code := runListDsyms(&buf, []string{
		"--source=env",
		"--dsym-paths", root,
	})
	if code != 0 {
		t.Fatalf("list-dsyms: code = %d\n%s", code, buf.String())
	}
	var out listDsymsOutput
	if err := json.Unmarshal(buf.Bytes(), &out); err != nil {
		t.Fatalf("json: %v\n%s", err, buf.String())
	}
	if len(out.Bundles) != 1 {
		t.Fatalf("bundles = %d, want 1\n%s", len(out.Bundles), buf.String())
	}
	b := out.Bundles[0]
	if b.Path != bundle {
		t.Errorf("bundle path = %q, want %q", b.Path, bundle)
	}
	if b.ImageName != "Ls" {
		t.Errorf("image_name = %q, want Ls", b.ImageName)
	}
	if len(b.UUIDs) == 0 {
		t.Error("no UUIDs read from bundle")
	}
	for _, u := range b.UUIDs {
		if u.UUID == "" || u.Arch == "" {
			t.Errorf("bundle UUID entry incomplete: %+v", u)
		}
	}
	if b.Source != "env" {
		t.Errorf("source = %q, want env", b.Source)
	}
}
