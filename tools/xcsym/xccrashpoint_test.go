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
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsXccrashpointPath(tc.path); got != tc.want {
				t.Errorf("IsXccrashpointPath(%q) = %v, want %v", tc.path, got, tc.want)
			}
		})
	}
}

// makeBundle builds a minimal .xccrashpoint at root with the given Filter
// directory names. Each filter gets a Logs/sample.crash and a
// LocallySymbolicated/sample.crash. The returned slice mirrors the input
// order so tests can index into it for path assertions.
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
	if res.UsedLocallySymbolicated {
		t.Error("UsedLocallySymbolicated = true, want false (default prefers raw)")
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
	if !res.UsedLocallySymbolicated {
		t.Error("UsedLocallySymbolicated = false, want true")
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
	if res.UsedLocallySymbolicated {
		t.Error("UsedLocallySymbolicated = true, want false after fallback")
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
