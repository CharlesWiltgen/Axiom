package main

// TriageResult is the corpus-level output of `xcsym triage` (compact JSON).
type TriageResult struct {
	Tool       string        `json:"tool"`
	Subcommand string        `json:"subcommand"`
	Version    string        `json:"version"`
	Summary    TriageSummary `json:"summary"`
	Issues     []TriageIssue `json:"issues"`
	Clusters   []Cluster     `json:"clusters"`
	Errors     []TriageError `json:"errors,omitempty"`
}

type TriageSummary struct {
	Total             int `json:"total"`
	Crashes           int `json:"crashes"`
	Hangs             int `json:"hangs"`
	Skipped           int `json:"skipped"`
	Clusters          int `json:"clusters"`
	FlaggedNoise      int `json:"flagged_noise"`
	CandidateFamilies int `json:"candidate_families"`
}

type TriageIssue struct {
	IssueID           string       `json:"issue_id"`
	Title             string       `json:"title,omitempty"`
	Kind              string       `json:"kind"`
	Impact            NRImpact     `json:"impact"`
	PatternTag        string       `json:"pattern_tag"`
	PatternConfidence string       `json:"pattern_confidence"`
	RuleID            string       `json:"pattern_rule_id,omitempty"`
	ClusterKey        string       `json:"cluster_key"`
	ClusterConfidence string       `json:"cluster_confidence,omitempty"`
	NoiseFlags        []NoiseFlag  `json:"noise_flags"`
	Enrichment        []Enrichment `json:"enrichment,omitempty"`
	TopFrames         []string     `json:"top_frames,omitempty"`
}

type Cluster struct {
	ClusterKey         string   `json:"cluster_key"`
	ClusterConfidence  string   `json:"cluster_confidence"`
	IssueIDs           []string `json:"issue_ids"`
	DominantPatternTag string   `json:"dominant_pattern_tag"`
	TotalUsers         int      `json:"total_users"`
	TotalEvents        int      `json:"total_events"`
}

// NoiseFlag records why an issue was deprioritized. DeprioritizeSafety is
// deliberately NOT called "confidence": pattern_confidence and cluster_confidence
// both mean evidence strength, while this rates how safe the deprioritization is
// — a rule can match exactly and still be unsafe to act on. Sharing the name
// across two meanings is what let a strict-matcher rule read as a certain
// verdict (Axiom-pfp).
type NoiseFlag struct {
	Class              string `json:"class"`
	RuleID             string `json:"rule_id"`
	DeprioritizeSafety string `json:"deprioritize_safety"`
	Reason             string `json:"reason"`
}

type Enrichment struct {
	Kind string `json:"kind"`
	Note string `json:"note"`
	See  string `json:"see"`
}

type TriageError struct {
	IssueID string `json:"issue_id,omitempty"`
	Reason  string `json:"reason"`
}

// Thresholds are run inputs that keep noise rules a pure function of (corpus,
// thresholds). Zero values disable the rules that need them.
type Thresholds struct {
	LatestVersion string
	OSFloor       string
	MinUsers      int
}
