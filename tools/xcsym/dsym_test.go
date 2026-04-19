package main

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestFindDsym_ExplicitOverride(t *testing.T) {
	d := NewDiscoverer(DiscovererOptions{Explicit: "/bin/ls"})
	entry, err := d.Find(context.Background(), "ANY-UUID", "arm64")
	if err != nil {
		t.Fatalf("Find: %v", err)
	}
	if entry.Path != "/bin/ls" {
		t.Errorf("expected /bin/ls, got %q", entry.Path)
	}
	if entry.Source != "explicit" {
		t.Errorf("expected Source=explicit, got %q", entry.Source)
	}
}

func TestFindDsym_NotFound(t *testing.T) {
	d := NewDiscoverer(DiscovererOptions{
		SkipSpotlight: true,
		SkipDefaults:  true,
	})
	_, err := d.Find(context.Background(), "00000000-0000-0000-0000-000000000000", "arm64")
	if err == nil {
		t.Fatal("expected not-found error")
	}
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err = %v, want wrapped ErrNotFound (so callers can distinguish from tool failures)", err)
	}
}

func TestFindDsym_ExplicitByUUID(t *testing.T) {
	targetUUID := "AAAAAAAA-0000-0000-0000-000000000000"
	otherUUID := "BBBBBBBB-0000-0000-0000-000000000000"
	d := NewDiscoverer(DiscovererOptions{
		ExplicitByUUID: map[string]string{targetUUID: "/bin/ls"},
		SkipSpotlight:  true,
		SkipDefaults:   true,
	})

	entry, err := d.Find(context.Background(), targetUUID, "")
	if err != nil {
		t.Fatalf("Find(target): %v", err)
	}
	if entry.Path != "/bin/ls" {
		t.Errorf("Path = %q, want /bin/ls", entry.Path)
	}
	if entry.Source != "explicit" {
		t.Errorf("Source = %q, want explicit", entry.Source)
	}

	_, err = d.Find(context.Background(), otherUUID, "")
	if err == nil {
		t.Fatal("Find(other): expected error for UUID not in ExplicitByUUID")
	}
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("other UUID error = %v, want ErrNotFound", err)
	}
}

func TestFindDsym_ExplicitByUUID_NormalizesKey(t *testing.T) {
	// Caller passes a lowercase undashed UUID; lookup with dashed uppercase.
	d := NewDiscoverer(DiscovererOptions{
		ExplicitByUUID: map[string]string{"aabbccdd000011112222333344445555": "/bin/ls"},
		SkipSpotlight:  true,
		SkipDefaults:   true,
	})
	entry, err := d.Find(context.Background(), "AABBCCDD-0000-1111-2222-333344445555", "")
	if err != nil {
		t.Fatalf("Find: %v", err)
	}
	if entry.Source != "explicit" {
		t.Errorf("Source = %q, want explicit", entry.Source)
	}
}

// setupFakeArchive writes /bin/ls into <tempdir>/<name>.xcarchive/dSYMs/<name>.app.dSYM
// and returns the path to the .dSYM bundle. /bin/ls has real UUIDs we can read.
func setupFakeArchive(t *testing.T, name string) string {
	t.Helper()
	return setupFakeDsymInLayout(t, filepath.Join(name+".xcarchive", "dSYMs", name+".app.dSYM"), name)
}

// setupFakeDsymInLayout writes /bin/ls as the DWARF binary inside a <.dSYM> bundle
// located at <tempdir>/<relativeBundlePath>. Returns the bundle path.
func setupFakeDsymInLayout(t *testing.T, relativeBundlePath, binaryName string) string {
	t.Helper()
	dir := t.TempDir()
	bundle := filepath.Join(dir, relativeBundlePath)
	dwarf := filepath.Join(bundle, "Contents", "Resources", "DWARF")
	if err := os.MkdirAll(dwarf, 0o755); err != nil {
		t.Fatal(err)
	}
	src, err := os.ReadFile("/bin/ls")
	if err != nil {
		t.Fatalf("cannot read /bin/ls: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dwarf, binaryName), src, 0o755); err != nil {
		t.Fatal(err)
	}
	return bundle
}

func TestFindDsym_ArchiveScan(t *testing.T) {
	if _, err := exec.LookPath("xcrun"); err != nil {
		t.Skip("xcrun not available")
	}
	bundle := setupFakeArchive(t, "MyApp")
	archivesRoot := filepath.Dir(filepath.Dir(filepath.Dir(bundle))) // up to tempdir

	dwarf := filepath.Join(bundle, "Contents", "Resources", "DWARF")
	entries, _ := os.ReadDir(dwarf)
	if len(entries) == 0 {
		t.Fatal("no binaries in fixture DWARF dir")
	}
	binPath := filepath.Join(dwarf, entries[0].Name())
	uuids, err := ReadUUIDs(context.Background(), binPath)
	if err != nil || len(uuids) == 0 {
		t.Skipf("cannot read UUIDs from test fixture: %v", err)
	}
	targetUUID := uuids[0].UUID
	targetArch := uuids[0].Arch

	d := NewDiscoverer(DiscovererOptions{
		ArchivesPaths: []string{archivesRoot},
		SkipSpotlight: true,
		SkipDefaults:  true,
	})
	entry, err := d.Find(context.Background(), targetUUID, targetArch)
	if err != nil {
		t.Fatalf("Find: %v", err)
	}
	if entry.Source != "archives" {
		t.Errorf("Source = %q, want archives", entry.Source)
	}
	if !strings.HasSuffix(entry.Path, ".dSYM") {
		t.Errorf("Path = %q, want *.dSYM", entry.Path)
	}
}

func TestFindDsym_Spotlight(t *testing.T) {
	if _, err := exec.LookPath("mdfind"); err != nil {
		t.Skip("mdfind not available")
	}
	out, _ := exec.Command("mdfind", "kMDItemContentType == 'com.apple.xcode.dsym'").Output()
	if len(strings.TrimSpace(string(out))) == 0 {
		t.Skip("no indexed dSYMs on this host")
	}
	firstDsym := strings.SplitN(strings.TrimSpace(string(out)), "\n", 2)[0]
	dwarfDir := filepath.Join(firstDsym, "Contents", "Resources", "DWARF")
	dwarfEntries, _ := os.ReadDir(dwarfDir)
	if len(dwarfEntries) == 0 {
		t.Skip("first spotlight dSYM has no DWARF entries")
	}
	uuids, err := ReadUUIDs(context.Background(), filepath.Join(dwarfDir, dwarfEntries[0].Name()))
	if err != nil || len(uuids) == 0 {
		t.Skip("cannot read UUIDs from spotlight result")
	}

	d := NewDiscoverer(DiscovererOptions{SkipDefaults: true})
	entry, err := d.Find(context.Background(), uuids[0].UUID, uuids[0].Arch)
	if err != nil {
		t.Fatalf("Find via spotlight: %v", err)
	}
	// Accept either spotlight or cache (if a previous test populated the cache).
	if entry.Source != "spotlight" && entry.Source != "cache" {
		t.Logf("entry source = %q (expected spotlight or cache)", entry.Source)
	}
}

func TestFindDsym_DerivedDataScan(t *testing.T) {
	if _, err := exec.LookPath("xcrun"); err != nil {
		t.Skip("xcrun not available")
	}
	// Layout: DerivedData/<proj>/Build/Products/Debug-iphonesimulator/MyApp.app.dSYM
	bundle := setupFakeDsymInLayout(t,
		filepath.Join("Proj-abc123", "Build", "Products", "Debug-iphonesimulator", "MyApp.app.dSYM"),
		"MyApp")
	derivedRoot := filepath.Dir(filepath.Dir(filepath.Dir(filepath.Dir(filepath.Dir(bundle)))))

	dwarf := filepath.Join(bundle, "Contents", "Resources", "DWARF")
	entries, _ := os.ReadDir(dwarf)
	binPath := filepath.Join(dwarf, entries[0].Name())
	uuids, err := ReadUUIDs(context.Background(), binPath)
	if err != nil || len(uuids) == 0 {
		t.Skipf("cannot read UUIDs: %v", err)
	}

	d := NewDiscoverer(DiscovererOptions{
		DerivedDataPaths: []string{derivedRoot},
		SkipSpotlight:    true,
		SkipDefaults:     true,
	})
	entry, err := d.Find(context.Background(), uuids[0].UUID, uuids[0].Arch)
	if err != nil {
		t.Fatalf("Find: %v", err)
	}
	if entry.Source != "deriveddata" {
		t.Errorf("Source = %q, want deriveddata", entry.Source)
	}
}

func TestFindDsym_DownloadsScan(t *testing.T) {
	if _, err := exec.LookPath("xcrun"); err != nil {
		t.Skip("xcrun not available")
	}
	bundle := setupFakeDsymInLayout(t, "MyApp.app.dSYM", "MyApp")
	downloadsRoot := filepath.Dir(bundle)

	dwarf := filepath.Join(bundle, "Contents", "Resources", "DWARF")
	entries, _ := os.ReadDir(dwarf)
	uuids, err := ReadUUIDs(context.Background(), filepath.Join(dwarf, entries[0].Name()))
	if err != nil || len(uuids) == 0 {
		t.Skipf("cannot read UUIDs: %v", err)
	}

	d := NewDiscoverer(DiscovererOptions{
		DownloadsPaths: []string{downloadsRoot},
		SkipSpotlight:  true,
		SkipDefaults:   true,
	})
	entry, err := d.Find(context.Background(), uuids[0].UUID, uuids[0].Arch)
	if err != nil {
		t.Fatalf("Find: %v", err)
	}
	if entry.Source != "downloads" {
		t.Errorf("Source = %q, want downloads", entry.Source)
	}
}

func TestFindDsym_EnvPaths(t *testing.T) {
	if _, err := exec.LookPath("xcrun"); err != nil {
		t.Skip("xcrun not available")
	}
	bundle := setupFakeDsymInLayout(t, "MyApp.app.dSYM", "MyApp")
	envRoot := filepath.Dir(bundle)

	dwarf := filepath.Join(bundle, "Contents", "Resources", "DWARF")
	entries, _ := os.ReadDir(dwarf)
	uuids, err := ReadUUIDs(context.Background(), filepath.Join(dwarf, entries[0].Name()))
	if err != nil || len(uuids) == 0 {
		t.Skipf("cannot read UUIDs: %v", err)
	}

	d := NewDiscoverer(DiscovererOptions{
		UserPaths:     []string{envRoot},
		SkipSpotlight: true,
		SkipDefaults:  true,
	})
	entry, err := d.Find(context.Background(), uuids[0].UUID, uuids[0].Arch)
	if err != nil {
		t.Fatalf("Find: %v", err)
	}
	if entry.Source != "env" {
		t.Errorf("Source = %q, want env", entry.Source)
	}
}

func TestDiscoverer_EnvPathsParsedFromXCSYM_DSYM_PATHS(t *testing.T) {
	bundle := setupFakeDsymInLayout(t, "MyApp.app.dSYM", "MyApp")
	envRoot := filepath.Dir(bundle)

	t.Setenv("XCSYM_DSYM_PATHS", envRoot+":/nonexistent/path")
	d := NewDiscovererFromEnv(DiscovererOptions{SkipSpotlight: true, SkipDefaults: true})
	if len(d.opts.UserPaths) != 2 {
		t.Fatalf("UserPaths = %v, want 2 entries", d.opts.UserPaths)
	}
	if d.opts.UserPaths[0] != envRoot {
		t.Errorf("UserPaths[0] = %q, want %q", d.opts.UserPaths[0], envRoot)
	}
}

func TestFindDsym_ArchMismatch(t *testing.T) {
	// Request an arch the dSYM doesn't have; discovery should still return
	// the dSYM (for mismatch classification by VerifyImages) rather than
	// reporting missing.
	if _, err := exec.LookPath("xcrun"); err != nil {
		t.Skip("xcrun not available")
	}
	bundle := setupFakeDsymInLayout(t, "MyApp.app.dSYM", "MyApp")
	root := filepath.Dir(bundle)

	dwarf := filepath.Join(bundle, "Contents", "Resources", "DWARF")
	entries, _ := os.ReadDir(dwarf)
	uuids, err := ReadUUIDs(context.Background(), filepath.Join(dwarf, entries[0].Name()))
	if err != nil || len(uuids) == 0 {
		t.Skipf("cannot read UUIDs: %v", err)
	}
	targetUUID := uuids[0].UUID
	realArch := uuids[0].Arch
	// Pick a clearly different arch.
	wrongArch := "armv7"
	if realArch == "armv7" {
		wrongArch = "arm64"
	}

	d := NewDiscoverer(DiscovererOptions{
		UserPaths:     []string{root},
		SkipSpotlight: true,
		SkipDefaults:  true,
	})
	entry, err := d.Find(context.Background(), targetUUID, wrongArch)
	if err != nil {
		t.Fatalf("Find: %v (arch mismatch should still return the entry)", err)
	}
	if entry.Arch == wrongArch {
		t.Errorf("entry.Arch = %q, expected the dSYM's real arch %q (so caller can detect mismatch)", entry.Arch, realArch)
	}
}
