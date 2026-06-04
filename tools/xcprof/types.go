package main

// Per-family support status. Distinguishes a clean app from an unmeasured one
// — the honesty rule from ADR-002 (never report "no findings" for "couldn't
// measure").
const (
	statusAvailable = "available" // exported, parsed, results present
	statusPartial   = "partial"   // present but only partially handled
	// statusNotExportable: schema present in the TOC but xctrace can't export it
	// (GUI may still show data). Phase 1 can't distinguish this from absence
	// without attempting the export; Phase 2 will report it. Defined now so the
	// status enum is stable for consumers (ADR-002 honesty contract).
	statusNotExportable = "not_exportable"
	statusNotPresent    = "not_present" // instrument wasn't in the recording
)

// FamilyStatus is one row of the support matrix.
type FamilyStatus struct {
	Family string `json:"family"`
	Status string `json:"status"`
	Note   string `json:"note,omitempty"`
}

// Summary is section 1 of the analyze report.
type Summary struct {
	Trace              string  `json:"trace"`
	Target             string  `json:"target,omitempty"`
	TargetPID          int     `json:"target_pid,omitempty"`
	Device             string  `json:"device,omitempty"`
	Platform           string  `json:"platform,omitempty"`
	OSVersion          string  `json:"os_version,omitempty"`
	RecordingMode      string  `json:"recording_mode,omitempty"`
	DurationSec        float64 `json:"duration_s,omitempty"`
	EndReason          string  `json:"end_reason,omitempty"`
	InstrumentsVersion string  `json:"instruments_version,omitempty"`
	TimeLimit          string  `json:"time_limit,omitempty"`
	Template           string  `json:"template,omitempty"`
}

// ScopeInfo records a --start-ms/--end-ms window when one was applied.
type ScopeInfo struct {
	StartMS        int64 `json:"start_ms"`
	EndMS          int64 `json:"end_ms"`
	SamplesInScope int   `json:"samples_in_scope"`
}

// AnalyzeReport is the structured output of `xcprof analyze`. Field order
// mirrors the markdown section contract; JSON is emitted compact for LLMs.
type AnalyzeReport struct {
	Tool       string           `json:"tool"`
	Version    string           `json:"version"`
	Summary    Summary          `json:"summary"`
	Support    []FamilyStatus   `json:"support"`
	CPUSamples int              `json:"cpu_samples"`
	Scope      *ScopeInfo       `json:"scope,omitempty"`
	HotFrames  []HotFrame       `json:"hot_frames,omitempty"`
	UserFrames []HotFrame       `json:"user_frames,omitempty"`
	MainThread *MainThreadStats `json:"main_thread,omitempty"`
	Notes      []string         `json:"notes,omitempty"`
}

// DoctorReport is the output of `xcprof doctor`.
type DoctorReport struct {
	Tool           string   `json:"tool"`
	Version        string   `json:"version"`
	XctracePath    string   `json:"xctrace_path,omitempty"`
	XctraceVersion string   `json:"xctrace_version,omitempty"`
	Instruments    int      `json:"instruments,omitempty"`
	Devices        int      `json:"devices,omitempty"`
	OK             bool     `json:"ok"`
	Problems       []string `json:"problems,omitempty"`
}
