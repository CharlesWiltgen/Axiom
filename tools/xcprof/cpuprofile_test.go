package main

import (
	"os"
	"testing"
)

func loadFixture(t *testing.T, name string) []byte {
	t.Helper()
	data, err := os.ReadFile("testdata/" + name)
	if err != nil {
		t.Fatalf("read fixture %s: %v", name, err)
	}
	return data
}

const wantSamples = 21 // rows in testdata/cpu-profile.xml

func TestParseCPUProfileRowCount(t *testing.T) {
	samples, err := parseCPUProfile(loadFixture(t, "cpu-profile.xml"))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(samples) != wantSamples {
		t.Fatalf("got %d samples, want %d", len(samples), wantSamples)
	}
}

// The whole point of the tool: rows after the first carry <tagged-backtrace
// ref="10"/> and MUST resolve to the same 3-frame stack. A naive parser sees
// empty backtraces here.
func TestParseCPUProfileResolvesBackReferences(t *testing.T) {
	samples, _ := parseCPUProfile(loadFixture(t, "cpu-profile.xml"))
	for i, s := range samples {
		if len(s.Frames) == 0 {
			t.Fatalf("sample %d has an empty backtrace — id/ref resolution failed", i)
		}
	}
}

func TestParseCPUProfileFirstStack(t *testing.T) {
	samples, _ := parseCPUProfile(loadFixture(t, "cpu-profile.xml"))
	got := samples[0].Frames
	want := []Frame{
		{Name: "write", Addr: "0x181c05835", BinaryName: "libsystem_kernel.dylib", BinaryPath: "/usr/lib/system/libsystem_kernel.dylib"},
		{Name: "0x1024044f0", Addr: "0x1024045d8", BinaryName: "yes", BinaryPath: "/usr/bin/yes"},
		{Name: "start", Addr: "0x181887e00", BinaryName: "dyld", BinaryPath: "/usr/lib/dyld"},
	}
	if len(got) != len(want) {
		t.Fatalf("got %d frames, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("frame %d = %+v, want %+v", i, got[i], want[i])
		}
	}
}

func TestParseCPUProfileFrameDistribution(t *testing.T) {
	samples, _ := parseCPUProfile(loadFixture(t, "cpu-profile.xml"))
	two, three := 0, 0
	for _, s := range samples {
		switch len(s.Frames) {
		case 2:
			two++
		case 3:
			three++
		}
	}
	// One sample dropped the kernel leaf (2 frames); the rest are 3.
	if two != 1 || three != wantSamples-1 {
		t.Errorf("frame distribution: 2-frame=%d 3-frame=%d, want 1 and %d", two, three, wantSamples-1)
	}
}

func TestParseCPUProfileAllMainThread(t *testing.T) {
	samples, _ := parseCPUProfile(loadFixture(t, "cpu-profile.xml"))
	for i, s := range samples {
		if !s.IsMainThread {
			t.Errorf("sample %d not flagged main-thread (thread=%q)", i, s.ThreadName)
		}
	}
}

func TestParseCPUProfileWeightsResolved(t *testing.T) {
	samples, _ := parseCPUProfile(loadFixture(t, "cpu-profile.xml"))
	// First row weight is 22 cycles (own id); a later row weight is 10165.
	if samples[0].Weight != 22 {
		t.Errorf("sample 0 weight = %d, want 22", samples[0].Weight)
	}
	if samples[1].Weight != 10165 {
		t.Errorf("sample 1 weight = %d, want 10165", samples[1].Weight)
	}
}

func FuzzParseCPUProfile(f *testing.F) {
	f.Add(loadFixtureBytes(f, "cpu-profile.xml"))
	f.Add([]byte(`<trace-query-result><node></node></trace-query-result>`))
	f.Add([]byte(``))
	f.Fuzz(func(t *testing.T, data []byte) {
		_, _ = parseCPUProfile(data) // must not panic
	})
}

func loadFixtureBytes(f *testing.F, name string) []byte {
	f.Helper()
	data, err := os.ReadFile("testdata/" + name)
	if err != nil {
		f.Fatalf("read fixture: %v", err)
	}
	return data
}
