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
	RuleID            string       `json:"rule_id,omitempty"`
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

type NoiseFlag struct {
	Class      string `json:"class"`
	RuleID     string `json:"rule_id"`
	Confidence string `json:"confidence"`
	Reason     string `json:"reason"`
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
