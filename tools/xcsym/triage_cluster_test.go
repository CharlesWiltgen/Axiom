package main

import (
	"strings"
	"testing"
)

func TestClusterKey_AppSignature(t *testing.T) {
	raw := &RawCrash{Kind: "crash", CrashedIdx: 0, Threads: []Thread{
		{Index: 0, Triggered: true, Frames: []Frame{
			{Image: "MyApp", Symbol: "A.f()", InApp: true},
			{Image: "MyApp", Symbol: "B.g()", InApp: true},
			{Image: "UIKitCore", Symbol: "sys"},
		}},
	}}
	key, conf := clusterKey(raw, CategorizeResult{Tag: "bad_memory_access"})
	if conf != "high" {
		t.Fatalf("confidence = %q, want high (has app frames)", conf)
	}
	if key == "" || key == "crash|bad_memory_access|" {
		t.Fatalf("expected app-frame signature in key, got %q", key)
	}
}

func TestClusterKey_SystemFallbackLowConfidence(t *testing.T) {
	raw := &RawCrash{Kind: "crash", CrashedIdx: 0, Threads: []Thread{
		{Index: 0, Triggered: true, Frames: []Frame{{Image: "libsystem_kernel.dylib", Symbol: "mach_msg"}}},
	}}
	key, conf := clusterKey(raw, CategorizeResult{Tag: "unclassified"})
	if conf != "low" {
		t.Fatalf("confidence = %q, want low (system fallback)", conf)
	}
	// Assert the key shape too — otherwise this test passes against the B2
	// stub, which also returns "low" (a false GREEN). Only the real impl emits
	// the "|sys:" marker.
	if !strings.Contains(key, "|sys:") {
		t.Fatalf("key = %q, want a |sys: system-fallback marker", key)
	}
}

func TestBuildClusters_LowMemberDowngradesHighCluster(t *testing.T) {
	// Exercises the seam fix: a high-confidence cluster must be downgraded to
	// low when any member carries low confidence.
	issues := []TriageIssue{
		{IssueID: "A", ClusterKey: "k1", ClusterConfidence: "high", PatternTag: "x", Impact: NRImpact{Users: 3}},
		{IssueID: "B", ClusterKey: "k1", ClusterConfidence: "low", PatternTag: "x", Impact: NRImpact{Users: 2}},
	}
	cl := buildClusters(issues)
	if len(cl) != 1 || cl[0].ClusterConfidence != "low" {
		t.Fatalf("expected low confidence after a low member, got %+v", cl)
	}
}

func TestBuildClusters_Aggregates(t *testing.T) {
	issues := []TriageIssue{
		{IssueID: "A", ClusterKey: "k1", PatternTag: "x", Impact: NRImpact{Users: 3, Events: 5}},
		{IssueID: "B", ClusterKey: "k1", PatternTag: "x", Impact: NRImpact{Users: 2, Events: 4}},
		{IssueID: "C", ClusterKey: "k2", PatternTag: "y", Impact: NRImpact{Users: 1, Events: 1}},
	}
	cl := buildClusters(issues)
	if len(cl) != 2 {
		t.Fatalf("clusters = %d, want 2", len(cl))
	}
	for _, c := range cl {
		if c.ClusterKey == "k1" && (c.TotalUsers != 5 || len(c.IssueIDs) != 2) {
			t.Fatalf("k1 aggregate wrong: %+v", c)
		}
	}
}
