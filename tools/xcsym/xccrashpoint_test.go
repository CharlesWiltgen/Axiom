package main

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestIsXccrashpointPath(t *testing.T) {
	tmp := t.TempDir()
	bundle := filepath.Join(tmp, "Foo.xccrashpoint")
	if err := os.Mkdir(bundle, 0o755); err != nil {
		t.Fatal(err)
	}
	notBundleDir := filepath.Join(tmp, "Foo.notxc")
	if err := os.Mkdir(notBundleDir, 0o755); err != nil {
		t.Fatal(err)
	}
	regularFile := filepath.Join(tmp, "regular.crash")
	if err := os.WriteFile(regularFile, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	suffixedFile := filepath.Join(tmp, "looks-like.xccrashpoint")
	if err := os.WriteFile(suffixedFile, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	// Case-insensitive bundle suffix: APFS/HFS+ are case-insensitive by
	// default, so a bundle round-tripped through Finder/zip/iCloud as
	// Foo.XCCrashpoint must still resolve.
	uppercaseBundle := filepath.Join(tmp, "Upper.XCCrashpoint")
	if err := os.Mkdir(uppercaseBundle, 0o755); err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		name string
		path string
		want bool
	}{
		{"bundle dir", bundle, true},
		{"non-bundle dir", notBundleDir, false},
		{"regular file", regularFile, false},
		// A file (not a directory) with the .xccrashpoint suffix is not a
		// bundle. Real .xccrashpoints are always directories.
		{"file with bundle suffix", suffixedFile, false},
		{"missing path", filepath.Join(tmp, "nope.xccrashpoint"), false},
		{"uppercase suffix", uppercaseBundle, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsXccrashpointPath(tc.path); got != tc.want {
				t.Errorf("IsXccrashpointPath(%q) = %v, want %v", tc.path, got, tc.want)
			}
		})
	}
}

// makeBundle returns the absolute Filter dir paths in input order so tests
// can Chtimes specific dirs without re-deriving the names.
func makeBundle(t *testing.T, root string, filterNames []string) []string {
	t.Helper()
	if err := os.MkdirAll(filepath.Join(root, "Filters"), 0o755); err != nil {
		t.Fatal(err)
	}
	var dirs []string
	for _, name := range filterNames {
		dir := filepath.Join(root, "Filters", name)
		if err := os.MkdirAll(filepath.Join(dir, "Logs", "LocallySymbolicated"), 0o755); err != nil {
			t.Fatal(err)
		}
		raw := filepath.Join(dir, "Logs", "raw.crash")
		if err := os.WriteFile(raw, []byte("raw"), 0o644); err != nil {
			t.Fatal(err)
		}
		sym := filepath.Join(dir, "Logs", "LocallySymbolicated", "sym.crash")
		if err := os.WriteFile(sym, []byte("sym"), 0o644); err != nil {
			t.Fatal(err)
		}
		dirs = append(dirs, dir)
	}
	return dirs
}

func TestResolveXccrashpoint_DefaultPicksRawCrash(t *testing.T) {
	bundle := filepath.Join(t.TempDir(), "Sample.xccrashpoint")
	makeBundle(t, bundle, []string{"Filter_only-1.0.0-Any"})

	res, err := ResolveXccrashpoint(bundle, xccrashpointResolveOptions{})
	if err != nil {
		t.Fatalf("ResolveXccrashpoint: %v", err)
	}
	if !strings.HasSuffix(res.CrashPath, filepath.Join("Logs", "raw.crash")) {
		t.Errorf("CrashPath = %q, want raw .crash directly under Logs/", res.CrashPath)
	}
	if !strings.HasSuffix(res.BundlePath, "Sample.xccrashpoint") {
		t.Errorf("BundlePath = %q, want absolute path ending in Sample.xccrashpoint", res.BundlePath)
	}
}

func TestResolveXccrashpoint_PreferLocallySymbolicated(t *testing.T) {
	bundle := filepath.Join(t.TempDir(), "Sample.xccrashpoint")
	makeBundle(t, bundle, []string{"Filter_only-1.0.0-Any"})

	res, err := ResolveXccrashpoint(bundle, xccrashpointResolveOptions{PreferLocallySymbolicated: true})
	if err != nil {
		t.Fatalf("ResolveXccrashpoint: %v", err)
	}
	wantSuffix := filepath.Join("LocallySymbolicated", "sym.crash")
	if !strings.HasSuffix(res.CrashPath, wantSuffix) {
		t.Errorf("CrashPath = %q, want suffix %q", res.CrashPath, wantSuffix)
	}
}

func TestResolveXccrashpoint_PreferLocallySymbolicated_FallbackToRaw(t *testing.T) {
	// Bundle has only the raw .crash — LocallySymbolicated/ is missing.
	// Asking for the symbolicated copy should fall back to raw rather than
	// fail; the user gave us a valid bundle.
	bundle := filepath.Join(t.TempDir(), "Sample.xccrashpoint")
	filterDir := filepath.Join(bundle, "Filters", "Filter_solo-1.0.0-Any", "Logs")
	if err := os.MkdirAll(filterDir, 0o755); err != nil {
		t.Fatal(err)
	}
	raw := filepath.Join(filterDir, "raw.crash")
	if err := os.WriteFile(raw, []byte("raw"), 0o644); err != nil {
		t.Fatal(err)
	}

	res, err := ResolveXccrashpoint(bundle, xccrashpointResolveOptions{PreferLocallySymbolicated: true})
	if err != nil {
		t.Fatalf("ResolveXccrashpoint: %v", err)
	}
	if !strings.HasSuffix(res.CrashPath, filepath.Join("Logs", "raw.crash")) {
		t.Errorf("CrashPath = %q, want fallback to raw.crash", res.CrashPath)
	}
}

func TestResolveXccrashpoint_MultiFilter_PicksMostRecentMtime(t *testing.T) {
	bundle := filepath.Join(t.TempDir(), "Sample.xccrashpoint")
	dirs := makeBundle(t, bundle, []string{
		"Filter_aaa-0.1.0-Any",
		"Filter_bbb-0.2.0-Any",
		"Filter_ccc-0.3.0-Any",
	})
	// Set explicit mtimes so the test isn't sensitive to filesystem
	// creation-order timing. Newest is bbb (the middle one) — proves we
	// don't accidentally pick by name order.
	old := time.Now().Add(-2 * time.Hour)
	mid := time.Now()
	older := time.Now().Add(-1 * time.Hour)
	for dir, ts := range map[string]time.Time{dirs[0]: old, dirs[1]: mid, dirs[2]: older} {
		if err := os.Chtimes(dir, ts, ts); err != nil {
			t.Fatal(err)
		}
	}

	res, err := ResolveXccrashpoint(bundle, xccrashpointResolveOptions{})
	if err != nil {
		t.Fatalf("ResolveXccrashpoint: %v", err)
	}
	if !strings.Contains(res.FilterDir, "Filter_bbb") {
		t.Errorf("FilterDir = %q, want most-recent-mtime (Filter_bbb)", res.FilterDir)
	}
}

func TestResolveXccrashpoint_FilterMatch(t *testing.T) {
	bundle := filepath.Join(t.TempDir(), "Sample.xccrashpoint")
	makeBundle(t, bundle, []string{
		"Filter_alpha-0.1.0-Any",
		"Filter_beta-0.2.0-Any",
		"Filter_gamma-0.3.0-Any",
	})

	res, err := ResolveXccrashpoint(bundle, xccrashpointResolveOptions{FilterMatch: "beta"})
	if err != nil {
		t.Fatalf("ResolveXccrashpoint: %v", err)
	}
	if !strings.Contains(res.FilterDir, "Filter_beta") {
		t.Errorf("FilterDir = %q, want match for substring 'beta'", res.FilterDir)
	}
}

func TestResolveXccrashpoint_FilterMatch_IsPlainSubstring(t *testing.T) {
	// Documents (and pins) that --filter is a plain substring match —
	// passing "1.0" matches both "Filter_x-1.0.0-Any" and
	// "Filter_y-11.0.0-Any". Users who want a single match should pass a
	// dash-bounded fragment like "1.0.0-Any". If this test ever needs to
	// flip to segment-anchored matching, expect a CLI breaking change.
	bundle := filepath.Join(t.TempDir(), "Sample.xccrashpoint")
	dirs := makeBundle(t, bundle, []string{
		"Filter_x-1.0.0-Any",
		"Filter_y-11.0.0-Any",
	})
	// Force the 11.0.0 entry to be the most-recent so we can prove "1.0"
	// matched both (otherwise mtime ordering alone would explain picking
	// 11.0.0).
	now := time.Now()
	old := now.Add(-1 * time.Hour)
	if err := os.Chtimes(dirs[0], old, old); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(dirs[1], now, now); err != nil {
		t.Fatal(err)
	}

	res, err := ResolveXccrashpoint(bundle, xccrashpointResolveOptions{FilterMatch: "1.0"})
	if err != nil {
		t.Fatalf("ResolveXccrashpoint: %v", err)
	}
	if !strings.Contains(res.FilterDir, "Filter_y-11.0.0") {
		t.Errorf("FilterDir = %q, want substring match including 11.0.0 entry (proves substring, not segment match)", res.FilterDir)
	}
}

func TestResolveXccrashpoint_FilterMatch_NoneMatched(t *testing.T) {
	bundle := filepath.Join(t.TempDir(), "Sample.xccrashpoint")
	makeBundle(t, bundle, []string{"Filter_alpha-0.1.0-Any"})

	_, err := ResolveXccrashpoint(bundle, xccrashpointResolveOptions{FilterMatch: "nomatch"})
	if !errors.Is(err, errNotXccrashpoint) {
		t.Errorf("err = %v, want errNotXccrashpoint", err)
	}
}

func TestResolveXccrashpoint_EmptyBundle(t *testing.T) {
	// Bundle exists, has no Filters/ — should reject as not-recognized
	// rather than panic or return a confusing error.
	bundle := filepath.Join(t.TempDir(), "Empty.xccrashpoint")
	if err := os.MkdirAll(bundle, 0o755); err != nil {
		t.Fatal(err)
	}
	_, err := ResolveXccrashpoint(bundle, xccrashpointResolveOptions{})
	if !errors.Is(err, errNotXccrashpoint) {
		t.Errorf("err = %v, want errNotXccrashpoint", err)
	}
}

func TestResolveXccrashpoint_FilterDirsButNoCrash(t *testing.T) {
	// Filter dir exists but its Logs/ is empty. Should reject rather than
	// return a phantom CrashPath.
	bundle := filepath.Join(t.TempDir(), "Hollow.xccrashpoint")
	logs := filepath.Join(bundle, "Filters", "Filter_x-1.0-Any", "Logs")
	if err := os.MkdirAll(logs, 0o755); err != nil {
		t.Fatal(err)
	}
	_, err := ResolveXccrashpoint(bundle, xccrashpointResolveOptions{})
	if !errors.Is(err, errNotXccrashpoint) {
		t.Errorf("err = %v, want errNotXccrashpoint", err)
	}
}

func TestResolveXccrashpoint_PermissionError_IsNotMistakenForEmpty(t *testing.T) {
	// Real I/O errors must not collapse to errNotXccrashpoint — that would
	// route the user to "your bundle is corrupt" when the actual problem is
	// a permission denial, stale NFS handle, etc. (Skipped when running as
	// root, where chmod-based permission denial doesn't fire.)
	if os.Geteuid() == 0 {
		t.Skip("permission test doesn't fire for root")
	}
	bundle := filepath.Join(t.TempDir(), "Locked.xccrashpoint")
	filtersDir := filepath.Join(bundle, "Filters")
	if err := os.MkdirAll(filtersDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(filtersDir, 0o000); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(filtersDir, 0o755) })

	_, err := ResolveXccrashpoint(bundle, xccrashpointResolveOptions{})
	if err == nil {
		t.Fatal("err = nil, want non-nil for permission denied")
	}
	if errors.Is(err, errNotXccrashpoint) {
		t.Errorf("err = %v, want a real I/O error (not errNotXccrashpoint)", err)
	}
}

func TestResolveXccrashpoint_CommittedFixture(t *testing.T) {
	// Drives the resolver against the real .xccrashpoint bundle committed
	// under testdata so a regression here is caught even if the synthetic
	// helpers above drift.
	bundle := "testdata/crashes/xccrashpoint/sample.xccrashpoint"
	res, err := ResolveXccrashpoint(bundle, xccrashpointResolveOptions{})
	if err != nil {
		t.Fatalf("ResolveXccrashpoint: %v", err)
	}
	if !strings.HasSuffix(res.CrashPath, ".crash") {
		t.Errorf("CrashPath = %q, want suffix .crash", res.CrashPath)
	}
	if strings.Contains(res.CrashPath, "LocallySymbolicated") {
		t.Errorf("CrashPath = %q, default should pick raw not LocallySymbolicated", res.CrashPath)
	}

	res2, err := ResolveXccrashpoint(bundle, xccrashpointResolveOptions{PreferLocallySymbolicated: true})
	if err != nil {
		t.Fatalf("ResolveXccrashpoint(prefer): %v", err)
	}
	if !strings.Contains(res2.CrashPath, "LocallySymbolicated") {
		t.Errorf("CrashPath = %q, want LocallySymbolicated when preferred", res2.CrashPath)
	}
}
