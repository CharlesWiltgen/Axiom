package main

import "encoding/json"

// NormalizedReport is the LLM-side-produced, provider-agnostic shape consumed
// by `xcsym triage`. One JSON object per stdin line (JSONL).
type NormalizedReport struct {
	Provider          string        `json:"provider"`
	IssueID           string        `json:"issue_id"`
	IssueURL          string        `json:"issue_url,omitempty"`
	Title             string        `json:"title,omitempty"`
	Kind              string        `json:"kind"` // crash | hang
	Impact            NRImpact      `json:"impact"`
	Versions          NRVersions    `json:"versions"`
	OS                NROS          `json:"os"`
	Exception         NRException   `json:"exception"`
	Termination       NRTermination `json:"termination"`
	CrashedThread     int           `json:"crashed_thread"`
	Threads           []NRThread    `json:"threads"`
	FramesUnavailable bool          `json:"frames_unavailable,omitempty"`
}

type NRImpact struct {
	Users     int    `json:"users"`
	Events    int    `json:"events"`
	FirstSeen string `json:"first_seen,omitempty"`
	LastSeen  string `json:"last_seen,omitempty"`
}

type NRVersions struct {
	Affected []string `json:"affected,omitempty"`
	Min      string   `json:"min,omitempty"`
	Max      string   `json:"max,omitempty"`
}

type NROS struct {
	Platform string   `json:"platform,omitempty"`
	Versions []string `json:"versions,omitempty"`
}

type NRException struct {
	Type          string `json:"type,omitempty"`
	Signal        string `json:"signal,omitempty"`
	Subtype       string `json:"subtype,omitempty"`
	Codes         string `json:"codes,omitempty"`
	MachException string `json:"mach_exception,omitempty"`
}

type NRTermination struct {
	Namespace string `json:"namespace,omitempty"`
	Code      string `json:"code,omitempty"`
}

type NRThread struct {
	Index   int       `json:"index"`
	Crashed bool      `json:"crashed,omitempty"`
	Frames  []NRFrame `json:"frames"`
}

type NRFrame struct {
	Image  string `json:"image,omitempty"`
	Symbol string `json:"symbol,omitempty"`
	Offset int    `json:"offset,omitempty"`
	InApp  bool   `json:"in_app,omitempty"`
}

func decodeNormalizedReport(line []byte) (*NormalizedReport, error) {
	var r NormalizedReport
	if err := json.Unmarshal(line, &r); err != nil {
		return nil, err
	}
	if r.Kind == "" {
		r.Kind = "crash"
	}
	return &r, nil
}
