package main

import (
	"strings"
	"testing"
)

func TestDetectEnrichment_DeadlockDBLock(t *testing.T) {
	raw := &RawCrash{Kind: "crash", CrashedIdx: 0,
		Termination: Termination{Code: "0xdead10cc"},
		Threads: []Thread{{Index: 0, Triggered: true, Frames: []Frame{
			{Image: "libsqlite3.dylib", Symbol: "sqlite3_step"},
			{Image: "GRDB", Symbol: "Database.execute"},
		}}}}
	en := detectEnrichment(&NormalizedReport{Kind: "crash"}, raw, CategorizeResult{Tag: "data_protection_violation"})
	if len(en) != 1 || !strings.Contains(en[0].See, "axiom-data") {
		t.Fatalf("expected axiom-data enrichment, got %+v", en)
	}
}

func TestDetectEnrichment_PlainDataProtNoBridge(t *testing.T) {
	raw := &RawCrash{Kind: "crash", CrashedIdx: 0,
		Termination: Termination{Code: "0xdead10cc"},
		Threads:     []Thread{{Index: 0, Triggered: true, Frames: []Frame{{Image: "Foundation", Symbol: "x"}}}}}
	en := detectEnrichment(&NormalizedReport{Kind: "crash"}, raw, CategorizeResult{Tag: "data_protection_violation"})
	if len(en) != 0 {
		t.Fatalf("expected no enrichment without DB/file frames, got %+v", en)
	}
}
