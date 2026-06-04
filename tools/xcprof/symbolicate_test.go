package main

import (
	"context"
	"reflect"
	"testing"
)

func TestParseAtosName(t *testing.T) {
	cases := map[string]string{
		"-[Foo bar] (in MyApp) (Foo.m:42)":            "-[Foo bar]",
		"closure #1 in run() (in App) (main.swift:8)": "closure #1 in run()",
		"main":        "main",
		"0x1024045d8": "0x1024045d8", // atos couldn't resolve -> stays raw
		"  spaced  ":  "spaced",
	}
	for in, want := range cases {
		if got := parseAtosName(in); got != want {
			t.Errorf("parseAtosName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestAtosArgs(t *testing.T) {
	got := atosArgs("/d/DWARF/App", "arm64", "0x100000000", []string{"0x100001000", "0x100002000"})
	want := []string{"-o", "/d/DWARF/App", "-arch", "arm64", "-l", "0x100000000", "0x100001000", "0x100002000"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("atosArgs = %v, want %v", got, want)
	}
	// arch + load address omitted when empty (let atos choose).
	got = atosArgs("/d/App", "", "", []string{"0x1"})
	want = []string{"-o", "/d/App", "0x1"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("atosArgs(no arch/load) = %v, want %v", got, want)
	}
}

func TestSymbolizeSamplesResolvesAndFallsBack(t *testing.T) {
	// Two images: app (UUID-A, has a dSYM) and lib (UUID-B, none). A frame with
	// no UUID, and an already-named frame, must be left entirely untouched.
	samples := []Sample{
		{Frames: []Frame{
			{Name: "0x1000", Addr: "0x1000", UUID: "UUID-A", Arch: "arm64", LoadAddr: "0x0"},
			{Name: "0x2000", Addr: "0x2000", UUID: "UUID-B", Arch: "arm64", LoadAddr: "0x0"},
			{Name: "0x3000", Addr: "0x3000", UUID: ""},     // no UUID -> can't resolve
			{Name: "main", Addr: "0x4000", UUID: "UUID-A"}, // already named
		}},
		{Frames: []Frame{
			{Name: "0x1000", Addr: "0x1000", UUID: "UUID-A", Arch: "arm64", LoadAddr: "0x0"}, // dup, same image
		}},
	}

	origFind, origAtos := findDsymFn, atosResolveFn
	defer func() { findDsymFn, atosResolveFn = origFind, origAtos }()

	var lookups []string
	findDsymFn = func(_ context.Context, uuid, _, _ string) (string, error) {
		lookups = append(lookups, uuid)
		if uuid == "UUID-A" {
			return "/fake/App.dSYM/Contents/Resources/DWARF/App", nil
		}
		return "", nil // UUID-B has no dSYM
	}
	atosResolveFn = func(_ context.Context, _, _, _ string, addrs []string) (map[string]string, error) {
		out := make(map[string]string, len(addrs))
		for _, a := range addrs {
			out[a] = "Sym_" + a
		}
		return out, nil
	}

	res := symbolizeSamples(context.Background(), samples, "")

	if res.Resolved != 2 {
		t.Errorf("Resolved = %d, want 2 (both app frames at 0x1000)", res.Resolved)
	}
	if res.Unresolved != 1 {
		t.Errorf("Unresolved = %d, want 1 (the lib frame, no dSYM)", res.Unresolved)
	}
	if samples[0].Frames[0].Name != "Sym_0x1000" {
		t.Errorf("app frame should be renamed, got %q", samples[0].Frames[0].Name)
	}
	if samples[0].Frames[1].Name != "0x2000" {
		t.Errorf("lib frame must stay raw (honest fallback), got %q", samples[0].Frames[1].Name)
	}
	if samples[0].Frames[2].Name != "0x3000" {
		t.Errorf("no-UUID frame must be untouched, got %q", samples[0].Frames[2].Name)
	}
	if samples[0].Frames[3].Name != "main" {
		t.Errorf("already-named frame must be untouched, got %q", samples[0].Frames[3].Name)
	}
	// Discovery is memoized per UUID: UUID-A resolved once despite 3 frames / dup addr.
	aCount := 0
	for _, u := range lookups {
		if u == "UUID-A" {
			aCount++
		}
	}
	if aCount != 1 {
		t.Errorf("UUID-A looked up %d times, want 1 (memoized)", aCount)
	}
}

func TestMapAtosLines(t *testing.T) {
	addrs := []string{"0x1", "0x2"}
	// One line per address; suffix stripped, unresolved stays raw.
	got := mapAtosLines(addrs, []byte("foo (in App) (a.c:1)\n0x2\n"))
	if got["0x1"] != "foo" || got["0x2"] != "0x2" {
		t.Errorf("mapAtosLines = %v, want 0x1=foo 0x2=0x2", got)
	}
	// Stray leading/trailing blank lines are trimmed before pairing.
	got = mapAtosLines(addrs, []byte("\na\nb\n\n"))
	if got["0x1"] != "a" || got["0x2"] != "b" {
		t.Errorf("mapAtosLines with stray blanks = %v, want 0x1=a 0x2=b", got)
	}
	// Genuine count disagreement -> nil: never pair a name with the wrong addr.
	if mapAtosLines(addrs, []byte("only-one-line\n")) != nil {
		t.Error("count mismatch must return nil (no misattribution)")
	}
}

func TestSymbolizeResultExplicitFlag(t *testing.T) {
	origFind, origAtos := findDsymFn, atosResolveFn
	defer func() { findDsymFn, atosResolveFn = origFind, origAtos }()
	findDsymFn = func(context.Context, string, string, string) (string, error) { return "", nil }
	atosResolveFn = func(context.Context, string, string, string, []string) (map[string]string, error) {
		return nil, nil
	}
	samples := []Sample{{Frames: []Frame{{Name: "0x1", Addr: "0x1", UUID: "U"}}}}
	if r := symbolizeSamples(context.Background(), samples, "/p/App.dSYM"); !r.Explicit {
		t.Errorf("Explicit must be true when --dsym is supplied, got %+v", r)
	}
	if r := symbolizeSamples(context.Background(), samples, ""); r.Explicit {
		t.Errorf("Explicit must be false without --dsym, got %+v", r)
	}
}

func TestSymbolizeSamplesNoWorkWhenAlreadyNamed(t *testing.T) {
	// All frames named -> Attempted, but no discovery/atos shell-out happens.
	origFind := findDsymFn
	defer func() { findDsymFn = origFind }()
	findDsymFn = func(context.Context, string, string, string) (string, error) {
		t.Fatal("findDsym must not be called when no frame needs symbolicating")
		return "", nil
	}
	samples := []Sample{{Frames: []Frame{{Name: "main", UUID: "U", Addr: "0x1"}}}}
	res := symbolizeSamples(context.Background(), samples, "")
	if !res.Attempted || res.Resolved != 0 || res.Unresolved != 0 {
		t.Errorf("want attempted/0/0 for an already-symbolicated trace, got %+v", res)
	}
}

func TestParseCPUProfileCapturesBinaryIdentity(t *testing.T) {
	samples, err := parseCPUProfile(loadFixture(t, "cpu-profile.xml"))
	if err != nil {
		t.Fatal(err)
	}
	// Frames must surface the <binary> UUID/arch/load-addr that --dsym needs.
	var found bool
	for _, s := range samples {
		for _, f := range s.Frames {
			if f.BinaryName != "libsystem_kernel.dylib" {
				continue
			}
			found = true
			if f.UUID != "CC1CF985-BC65-3725-809F-4C1E36B8F4BA" {
				t.Errorf("UUID = %q, want the fixture's libsystem_kernel UUID", f.UUID)
			}
			if f.Arch != "arm64e" {
				t.Errorf("Arch = %q, want arm64e", f.Arch)
			}
			if f.LoadAddr != "0x181c01000" {
				t.Errorf("LoadAddr = %q, want 0x181c01000", f.LoadAddr)
			}
		}
	}
	if !found {
		t.Fatal("libsystem_kernel.dylib frame not present in fixture")
	}
}
