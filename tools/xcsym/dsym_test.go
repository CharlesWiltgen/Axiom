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

// TestWalkRoots_MismatchYieldsToLaterExactMatch guards the fix for bead
// axiom-jtz (C2): when a root returns a UUID-matching entry with the wrong
// arch slice, walkRoots must keep scanning remaining roots in case one of
// them has the exact arch. Before this fix, walkRoots returned on the first
// non-nil entry — a wrong-arch dSYM in ArchivesPaths[0] would hide the
// correct arm64e dSYM sitting in ArchivesPaths[1].
//
// The scenario is physically impossible to reproduce with real dSYMs (slice
// UUIDs are content-derived, so "same UUID, different arch across bundles"
// can't occur in real dwarfdump output), so the test mocks the inner walk
// via walkForDsymUUIDFn to focus on the ordering logic itself.
func TestWalkRoots_MismatchYieldsToLaterExactMatch(t *testing.T) {
	r1 := t.TempDir()
	r2 := t.TempDir()
	orig := walkForDsymUUIDFn
	t.Cleanup(func() { walkForDsymUUIDFn = orig })
	walkForDsymUUIDFn = func(_ context.Context, root, uuid, arch string) (*DsymEntry, error) {
		switch root {
		case r1:
			return &DsymEntry{UUID: uuid, Arch: "x86_64", Path: root + "/Wrong.dSYM"}, nil
		case r2:
			return &DsymEntry{UUID: uuid, Arch: "arm64e", Path: root + "/Right.dSYM"}, nil
		}
		return nil, nil
	}

	got, err := walkRoots(context.Background(), []string{r1, r2}, "TARGET-UUID", "arm64e", "archives")
	if err != nil {
		t.Fatalf("walkRoots: %v", err)
	}
	if got == nil {
		t.Fatal("expected an entry, got nil")
	}
	if got.Arch != "arm64e" {
		t.Errorf("Arch = %q, want arm64e — walkRoots short-circuited on root[0]'s mismatch and missed root[1]'s exact match", got.Arch)
	}
	if got.Path != r2+"/Right.dSYM" {
		t.Errorf("Path = %q, want the arm64e dSYM from root[1]", got.Path)
	}
}

// TestWalkRoots_AllMismatchesReturnsFirst covers the fallback path: if no
// root has the exact arch, walkRoots must still return something (the first
// mismatch) so VerifyImages can classify the miss as arch-mismatch rather
// than wholly-missing.
func TestWalkRoots_AllMismatchesReturnsFirst(t *testing.T) {
	r1 := t.TempDir()
	r2 := t.TempDir()
	orig := walkForDsymUUIDFn
	t.Cleanup(func() { walkForDsymUUIDFn = orig })
	walkForDsymUUIDFn = func(_ context.Context, root, uuid, arch string) (*DsymEntry, error) {
		return &DsymEntry{UUID: uuid, Arch: "x86_64", Path: root + "/Mismatch.dSYM"}, nil
	}

	got, err := walkRoots(context.Background(), []string{r1, r2}, "TARGET-UUID", "arm64e", "archives")
	if err != nil {
		t.Fatalf("walkRoots: %v", err)
	}
	if got == nil {
		t.Fatal("expected a mismatch entry, got nil")
	}
	if got.Path != r1+"/Mismatch.dSYM" {
		t.Errorf("Path = %q, want first-root mismatch for stable ordering", got.Path)
	}
}

func TestFindDsym_FrameworksScan(t *testing.T) {
	if _, err := exec.LookPath("xcrun"); err != nil {
		t.Skip("xcrun not available")
	}
	bundle := setupFakeDsymInLayout(t, filepath.Join("Carthage", "Build", "iOS", "MyLib.framework.dSYM"), "MyLib")
	root := filepath.Dir(filepath.Dir(filepath.Dir(bundle))) // tempdir containing Carthage/

	dwarf := filepath.Join(bundle, "Contents", "Resources", "DWARF")
	entries, _ := os.ReadDir(dwarf)
	uuids, err := ReadUUIDs(context.Background(), filepath.Join(dwarf, entries[0].Name()))
	if err != nil || len(uuids) == 0 {
		t.Skipf("cannot read UUIDs: %v", err)
	}

	d := NewDiscoverer(DiscovererOptions{
		FrameworkRoots: []string{root},
		SkipSpotlight:  true,
		SkipDefaults:   true,
	})
	entry, err := d.Find(context.Background(), uuids[0].UUID, uuids[0].Arch)
	if err != nil {
		t.Fatalf("Find: %v", err)
	}
	if entry.Source != "frameworks" {
		t.Errorf("Source = %q, want frameworks", entry.Source)
	}
}

// TestFindDsym_FrameworksScanTimeoutNonFatal guards the fix for bead
// axiom-jtz (N4): an exhausted XCSYM_FRAMEWORK_SCAN_TIMEOUT budget must not
// abort the Find chain. The scan bails, the next source runs, and a genuinely
// missing UUID surfaces as ErrNotFound — not a wrapped DeadlineExceeded.
func TestFindDsym_FrameworksScanTimeoutNonFatal(t *testing.T) {
	// Any non-empty root would do; the 1ns budget fires before WalkDir even
	// enters the first directory. Use a tempdir to avoid touching cwd.
	root := t.TempDir()
	t.Setenv("XCSYM_FRAMEWORK_SCAN_TIMEOUT", "1ns")

	d := NewDiscoverer(DiscovererOptions{
		FrameworkRoots: []string{root},
		SkipSpotlight:  true,
		SkipDefaults:   true,
	})
	_, err := d.Find(context.Background(), "DEADBEEF-0000-0000-0000-000000000000", "arm64")
	if err == nil {
		t.Fatal("expected ErrNotFound after all sources exhausted")
	}
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err = %v, want wrapped ErrNotFound — a timed-out framework scan must not leak DeadlineExceeded up the Find chain", err)
	}
}

// TestDefaultFrameworkScanTimeout checks that XCSYM_FRAMEWORK_SCAN_TIMEOUT
// accepts both Go duration strings and bare integer seconds, and falls back
// to 500ms when unset/invalid. The design budget is 500ms.
func TestDefaultFrameworkScanTimeout(t *testing.T) {
	cases := []struct {
		name string
		env  string
		want string
	}{
		{"default", "", "500ms"},
		{"duration string", "250ms", "250ms"},
		{"bare seconds", "2", "2s"},
		{"invalid falls back", "not-a-duration", "500ms"},
		{"zero falls back", "0", "500ms"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			// t.Setenv with "" leaves the variable set-but-empty, which
			// DefaultFrameworkScanTimeout treats as unset (os.Getenv returns "").
			t.Setenv("XCSYM_FRAMEWORK_SCAN_TIMEOUT", c.env)
			got := DefaultFrameworkScanTimeout().String()
			if got != c.want {
				t.Errorf("DefaultFrameworkScanTimeout() = %q, want %q", got, c.want)
			}
		})
	}
}

// setupFakeDsymWithBinary writes the contents of srcBinary into a fake dSYM
// bundle's DWARF dir. Returns the bundle path. Use this when a test needs
// a dSYM whose DWARF carries a specific binary's real UUIDs (e.g. a stale
// Spotlight scenario where one bundle's UUID intentionally won't match
// another's).
func setupFakeDsymWithBinary(t *testing.T, relativeBundlePath, binaryName, srcBinary string) string {
	t.Helper()
	dir := t.TempDir()
	bundle := filepath.Join(dir, relativeBundlePath)
	dwarf := filepath.Join(bundle, "Contents", "Resources", "DWARF")
	if err := os.MkdirAll(dwarf, 0o755); err != nil {
		t.Fatal(err)
	}
	src, err := os.ReadFile(srcBinary)
	if err != nil {
		t.Fatalf("cannot read %s: %v", srcBinary, err)
	}
	if err := os.WriteFile(filepath.Join(dwarf, binaryName), src, 0o755); err != nil {
		t.Fatal(err)
	}
	return bundle
}

// TestFindViaSpotlight_SkipsStalePaths guards axiom-lub #2. When Spotlight's
// index is stale (it returns a path whose DWARF no longer carries the
// requested UUID), findViaSpotlight must continue to the next mdfind result
// rather than abort the Spotlight source. Without loop continuation, a
// single stale entry would mask every subsequent Spotlight result for the
// same UUID — including the one that would actually succeed.
//
// Test setup: two real dSYM bundles. The "stale" bundle's DWARF binary is
// /bin/cat (its UUIDs won't match /bin/ls's). The "fresh" bundle's DWARF
// binary is /bin/ls; we query for /bin/ls's real UUID. The stub returns
// the stale path BEFORE the fresh path so the loop has to skip past it.
func TestFindViaSpotlight_SkipsStalePaths(t *testing.T) {
	if _, err := exec.LookPath("xcrun"); err != nil {
		t.Skip("xcrun not available")
	}
	if _, err := os.Stat("/bin/cat"); err != nil {
		t.Skipf("/bin/cat not available: %v", err)
	}

	stale := setupFakeDsymWithBinary(t, "Stale.dSYM", "stalebin", "/bin/cat")
	fresh := setupFakeDsymWithBinary(t, "Fresh.dSYM", "freshbin", "/bin/ls")

	// Read /bin/ls's real UUID from the fresh bundle so the lookup target
	// is whatever the host's /bin/ls actually carries.
	freshDwarf := filepath.Join(fresh, "Contents", "Resources", "DWARF", "freshbin")
	uuids, err := ReadUUIDs(context.Background(), freshDwarf)
	if err != nil || len(uuids) == 0 {
		t.Skipf("cannot read UUIDs from /bin/ls fixture: %v", err)
	}
	targetUUID := uuids[0].UUID
	targetArch := uuids[0].Arch

	// Sanity: confirm the stale fixture's UUIDs don't accidentally include
	// the target. If /bin/cat ever shipped with the same UUID as /bin/ls
	// (vanishingly unlikely but possible on a custom toolchain), the test
	// would silently degrade to "two fresh paths" and stop guarding the
	// stale-skip path.
	staleDwarf := filepath.Join(stale, "Contents", "Resources", "DWARF", "stalebin")
	staleUUIDs, _ := ReadUUIDs(context.Background(), staleDwarf)
	for _, u := range staleUUIDs {
		if u.UUID == targetUUID {
			t.Skipf("/bin/cat and /bin/ls share UUID %s on this host — fixture invariant violated", targetUUID)
		}
	}

	orig := mdfindPathsForUUIDFn
	t.Cleanup(func() { mdfindPathsForUUIDFn = orig })
	mdfindPathsForUUIDFn = func(_ context.Context, uuid string) ([]string, error) {
		return []string{stale, fresh}, nil
	}

	d := NewDiscoverer(DiscovererOptions{
		SkipDefaults: true,
		SkipCache:    true,
	})
	entry, err := d.Find(context.Background(), targetUUID, targetArch)
	if err != nil {
		t.Fatalf("Find: %v (a stale Spotlight result must not abort the source)", err)
	}
	if entry == nil {
		t.Fatal("expected Find to skip the stale path and return the fresh entry")
	}
	if entry.Path != fresh {
		t.Errorf("Path = %q, want fresh bundle %q — the stale path masked the second mdfind result", entry.Path, fresh)
	}
	if entry.Source != "spotlight" {
		t.Errorf("Source = %q, want spotlight", entry.Source)
	}
}

// TestFindDsym_ExplicitByUUID_TrustsWithoutSliceVerification documents the
// intentional trust-without-verify contract for explicit overrides
// (axiom-lub #3). When the caller passes --dsym (Explicit) or its per-UUID
// equivalent (ExplicitByUUID), Find returns the entry after a single
// os.Stat — it does NOT inspect the bundle's DWARF dir to confirm any
// slice actually carries the requested UUID. The user said "use THIS
// file"; Find honors that.
//
// This means: in a universal-binary dSYM whose slices claim distinct UUIDs
// (a synthetic case, but possible when fixtures are hand-assembled or two
// real dSYMs are concatenated), an explicit override for one slice's UUID
// returns the bundle path even when the requested UUID isn't in any slice.
// Slice-UUID validation, if it ever happens, belongs at the layer that
// invokes atos with the override — not at discovery.
//
// A future refactor that adds DWARF inspection inside the Explicit /
// ExplicitByUUID branches of Find would silently change this contract;
// this test would fail loudly and force a deliberate decision about
// whether to keep trust-without-verify.
func TestFindDsym_ExplicitByUUID_TrustsWithoutSliceVerification(t *testing.T) {
	// Build a fake universal-style dSYM bundle with two DWARF binaries
	// claiming different UUIDs. Find must NOT walk this directory under
	// an explicit override — the path returns as-is.
	dir := t.TempDir()
	bundle := filepath.Join(dir, "MultiSlice.dSYM")
	dwarf := filepath.Join(bundle, "Contents", "Resources", "DWARF")
	if err := os.MkdirAll(dwarf, 0o755); err != nil {
		t.Fatal(err)
	}
	// Two slice files; their actual DWARF UUIDs are irrelevant because
	// Find never reads them under an explicit override.
	for _, name := range []string{"sliceA", "sliceB"} {
		if err := os.WriteFile(filepath.Join(dwarf, name), []byte("not-a-real-mach-o"), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	requestedUUID := "AAAAAAAA-1111-2222-3333-444444444444"
	d := NewDiscoverer(DiscovererOptions{
		ExplicitByUUID: map[string]string{requestedUUID: bundle},
		SkipSpotlight:  true,
		SkipCache:      true,
		SkipDefaults:   true,
	})

	entry, err := d.Find(context.Background(), requestedUUID, "arm64e")
	if err != nil {
		t.Fatalf("Find: %v (explicit override must return without slice validation)", err)
	}
	if entry.Path != bundle {
		t.Errorf("Path = %q, want %q (explicit override should be returned verbatim)", entry.Path, bundle)
	}
	if entry.Source != "explicit" {
		t.Errorf("Source = %q, want explicit", entry.Source)
	}
	// The entry's UUID is the requested UUID, not anything Find discovered
	// inside the bundle — that's the trust-without-verify contract.
	if entry.UUID != requestedUUID {
		t.Errorf("UUID = %q, want %q (Find should echo the requested UUID, not derive it from the bundle)", entry.UUID, requestedUUID)
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
