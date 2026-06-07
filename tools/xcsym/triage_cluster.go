package main

import (
	"sort"
	"strings"
)

const clusterSignatureFrames = 3

// clusterKey returns a conservative mechanical cluster signature and a
// confidence. It uses the top app (InApp) frames when present; with no app
// frames it falls back to the top system frame and marks confidence "low" so
// the agent treats the bucket as a bag to split, never a real cluster.
func clusterKey(raw *RawCrash, cat CategorizeResult) (string, string) {
	role := "crash"
	if raw.Kind == "hang" {
		role = "hang"
	}
	var crashed *Thread
	if raw.CrashedIdx >= 0 && raw.CrashedIdx < len(raw.Threads) {
		crashed = &raw.Threads[raw.CrashedIdx]
	}
	if crashed == nil {
		return role + "|" + cat.Tag + "|", "low"
	}
	var appSig []string
	for _, f := range crashed.Frames {
		if f.InApp {
			appSig = append(appSig, frameSig(f))
			if len(appSig) == clusterSignatureFrames {
				break
			}
		}
	}
	if len(appSig) > 0 {
		return role + "|" + cat.Tag + "|" + strings.Join(appSig, ">"), "high"
	}
	// System fallback: top frame only, low confidence.
	top := ""
	if len(crashed.Frames) > 0 {
		top = frameSig(crashed.Frames[0])
	}
	return role + "|" + cat.Tag + "|sys:" + top, "low"
}

func frameSig(f Frame) string {
	if f.Symbol != "" {
		return f.Symbol
	}
	return f.Image
}

// buildClusters groups issues by ClusterKey and aggregates impact. The
// per-cluster confidence is recomputed as "low" if any member key carries the
// system-fallback "|sys:" marker.
func buildClusters(issues []TriageIssue) []Cluster {
	idx := map[string]*Cluster{}
	var order []string
	for _, is := range issues {
		c, ok := idx[is.ClusterKey]
		if !ok {
			// Use the confidence clusterKey computed for the issue, not a
			// re-parse of the key string — a nil-crashed-thread key like
			// "crash|unclassified|" is "low" without carrying a "|sys:" marker.
			conf := is.ClusterConfidence
			if conf == "" {
				conf = "low"
			}
			// DominantPatternTag is the first member's tag, which equals every
			// member's tag because clusterKey embeds cat.Tag — "first" == "dominant"
			// by construction. No separate majority-vote pass is needed.
			c = &Cluster{ClusterKey: is.ClusterKey, ClusterConfidence: conf, DominantPatternTag: is.PatternTag}
			idx[is.ClusterKey] = c
			order = append(order, is.ClusterKey)
		} else if is.ClusterConfidence == "low" {
			c.ClusterConfidence = "low" // any low-confidence member downgrades the bag
		}
		c.IssueIDs = append(c.IssueIDs, is.IssueID)
		c.TotalUsers += is.Impact.Users
		c.TotalEvents += is.Impact.Events
	}
	out := make([]Cluster, 0, len(order))
	for _, k := range order {
		out = append(out, *idx[k])
	}
	// Stable, impact-desc ordering so the agent sees the biggest clusters first.
	sort.SliceStable(out, func(i, j int) bool { return out[i].TotalUsers > out[j].TotalUsers })
	return out
}

var dbLockFrameSubstrings = []string{"sqlite3_", "GRDB", "Database", "NSFileCoordinator", "FileCoordination"}

// detectEnrichment adds cross-skill pointers. The flagship case: a
// data_protection_violation (0xdead10cc) whose crashed-thread frames show
// SQLite/GRDB/file-coordination activity almost always means a shared DB/file
// lock held across suspension — the actionable fix lives in axiom-data.
func detectEnrichment(r *NormalizedReport, raw *RawCrash, cat CategorizeResult) []Enrichment {
	if cat.Tag != "data_protection_violation" {
		return nil
	}
	if raw.CrashedIdx < 0 || raw.CrashedIdx >= len(raw.Threads) {
		return nil
	}
	hasDB := false
	for _, f := range raw.Threads[raw.CrashedIdx].Frames {
		for _, sub := range dbLockFrameSubstrings {
			if strings.Contains(f.Symbol, sub) || strings.Contains(f.Image, sub) {
				hasDB = true
			}
		}
	}
	if !hasDB {
		return nil
	}
	return []Enrichment{{
		Kind: "cross_skill",
		Note: "0xdead10cc with a DB/file-lock stack near suspension — likely held a shared-DB/file lock across app suspension",
		See:  "axiom-data: GRDB suspension (observesSuspensionNotifications, file-protection class)",
	}}
}
