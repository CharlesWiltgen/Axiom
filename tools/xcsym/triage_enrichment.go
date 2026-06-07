package main

var dbLockFrameSubstrings = []string{"sqlite3_", "GRDB", "Database", "NSFileCoordinator", "FileCoordination"}

// detectEnrichment adds cross-skill pointers. The flagship case: a
// data_protection_violation (0xdead10cc) whose crashed-thread frames show
// SQLite/GRDB/file-coordination activity almost always means a shared DB/file
// lock held across suspension — the actionable fix lives in axiom-data.
//
// It operates on (NormalizedReport, RawCrash, CategorizeResult), not on
// clusters, so it lives here rather than in triage_cluster.go. If a second
// enrichment rule is ever added, refactor the single hard-coded conditional
// below into a data-driven enrichmentRules slice mirroring noiseRules.
func detectEnrichment(r *NormalizedReport, raw *RawCrash, cat CategorizeResult) []Enrichment {
	if cat.Tag != "data_protection_violation" {
		return nil
	}
	// Reuse the package's crashed-frame scanners (n=0 = all frames); they do the
	// CrashedIdx bounds check internally. A DB/file-lock signature can appear in
	// either the symbol or the image, so match on both.
	if hasAnyCrashedFrameSymbol(raw, dbLockFrameSubstrings, 0) == "" &&
		hasAnyCrashedFrameImage(raw, dbLockFrameSubstrings, 0) == "" {
		return nil
	}
	return []Enrichment{{
		Kind: "cross_skill",
		Note: "0xdead10cc with a DB/file-lock stack near suspension — likely held a shared-DB/file lock across app suspension",
		See:  "axiom-data: GRDB suspension (observesSuspensionNotifications, file-protection class)",
	}}
}
