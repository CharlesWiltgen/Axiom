package main

import "testing"

func TestCountListLines(t *testing.T) {
	out := []byte("== Instruments ==\nActivity Monitor\nAllocations\nLeaks\n\nTime Profiler\n")
	if got := countListLines(out); got != 4 {
		t.Errorf("countListLines = %d, want 4", got)
	}
}

func TestCountListLinesEmpty(t *testing.T) {
	if got := countListLines([]byte("== Devices ==\n")); got != 0 {
		t.Errorf("countListLines = %d, want 0", got)
	}
}

func TestVersionConstSet(t *testing.T) {
	if version == "" {
		t.Fatal("version const must be set")
	}
}
