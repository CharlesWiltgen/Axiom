package main

// CrashReport is the top-level structured output of `xcsym crash`.
//
// Images vs. ImagesSummary is tier-dependent: standard and full emit the
// full ImageStatus; summary replaces it with a counts-only ImagesSummary to
// stay within its 2 KB size budget. The two fields are mutually exclusive.
type CrashReport struct {
	Tool          string         `json:"tool"`
	Version       string         `json:"version"`
	Format        string         `json:"format"` // summary | standard | full
	Environment   Environment    `json:"environment"`
	Input         InputInfo      `json:"input"`
	Crash         CrashInfo      `json:"crash"`
	Images        *ImageStatus   `json:"images,omitempty"`
	ImagesSummary *ImagesSummary `json:"images_summary,omitempty"`
	Warnings      []string       `json:"warnings"`
	SizeWarning   *string        `json:"size_warning,omitempty"`
}

// ImagesSummary is the counts-only shape emitted in the summary tier.
type ImagesSummary struct {
	MatchedCount    int `json:"matched_count"`
	MismatchedCount int `json:"mismatched_count"`
	MissingCount    int `json:"missing_count"`
}

// Environment fields are all omitempty because the summary tier strips
// everything except CLTVersionShort to keep the report under 2 KB.
type Environment struct {
	AtosVersion          string `json:"atos_version,omitempty"`
	CLTVersion           string `json:"clt_version,omitempty"`
	CLTVersionShort      string `json:"clt_version_short,omitempty"`
	SwiftDemangleVersion string `json:"swift_demangle_version,omitempty"`
	HostArch             string `json:"host_arch,omitempty"`
	XcodePath            string `json:"xcode_path,omitempty"`
}

type InputInfo struct {
	Path   string `json:"path"`
	Format string `json:"format"` // ips_json_v1 | ips_json_v2 | metrickit_json
	// Bundle is the original .xccrashpoint path when the resolver walked
	// into a bundle to find Path; omitempty so non-bundle runs don't see
	// a new field. The resolver picks Logs/*.crash by default; check
	// strings.Contains(Path, "LocallySymbolicated") if you need to know
	// which copy was chosen.
	Bundle string `json:"bundle,omitempty"`
}

type CrashInfo struct {
	App                   AppInfo     `json:"app"`
	OS                    OSInfo      `json:"os"`
	Arch                  string      `json:"arch"`
	Exception             Exception   `json:"exception"`
	Termination           Termination `json:"termination"`
	PatternTag            string      `json:"pattern_tag"`
	PatternConfidence     string      `json:"pattern_confidence"` // high | heuristic | low
	PatternRuleID         string      `json:"pattern_rule_id"`
	PatternReason         string      `json:"pattern_reason"`
	CrashedThread         Thread      `json:"crashed_thread"`
	OtherThreadsTopFrames []ThreadTop `json:"other_threads_top_frames"`
	AllThreads            []Thread    `json:"all_threads,omitempty"` // full tier only
}

type AppInfo struct {
	Name     string `json:"name"`
	Version  string `json:"version"`
	BundleID string `json:"bundle_id"`
}

type OSInfo struct {
	Platform    string `json:"platform"`
	Version     string `json:"version"`
	Build       string `json:"build"`
	IsSimulator bool   `json:"is_simulator"`
}

type Exception struct {
	Type    string `json:"type"`
	Codes   string `json:"codes"`
	Subtype string `json:"subtype"`
	Signal  string `json:"signal,omitempty"`
}

type Termination struct {
	Namespace string  `json:"namespace"`
	Code      string  `json:"code"`
	Reason    *string `json:"reason,omitempty"`
}

type Thread struct {
	Index     int          `json:"index"`
	Triggered bool         `json:"triggered"`
	Frames    []Frame      `json:"frames"`
	State     *ThreadState `json:"thread_state,omitempty"`
}

// ThreadState captures the two register values xcsym needs for pattern
// detection (currently only R-stack-overflow-01, which checks faulting
// address proximity to SP). Populated by the Phase 5 crash parser; nil when
// the source .ips didn't carry threadState.
type ThreadState struct {
	SP uint64 `json:"sp"`
	PC uint64 `json:"pc"`
}

type ThreadTop struct {
	Index  int     `json:"index"`
	Frames []Frame `json:"frames"`
}

type Frame struct {
	Index       int    `json:"index"`
	Address     string `json:"address"`
	Image       string `json:"image"`
	ImageOffset int    `json:"image_offset,omitempty"`
	// UUID is the binary UUID of the image this frame belongs to, plumbed in
	// at parse time (ips: usedImages[imageIndex].uuid; MetricKit: binaryUUID).
	// Internal plumbing for the symbolicate pipeline — frames are grouped by
	// UUID instead of Image name so two images sharing a name (multi-framework
	// copies, or MetricKit where binaryName can repeat across distinct UUIDs)
	// don't silently cross-attribute. Not serialized; the authoritative UUID
	// list lives in CrashReport.Images.
	UUID         string `json:"-"`
	Symbol       string `json:"symbol,omitempty"`
	File         string `json:"file,omitempty"`
	Line         int    `json:"line,omitempty"`
	Symbolicated bool   `json:"symbolicated"`
}

type ImageStatus struct {
	Matched    []ImageMatch `json:"matched"`
	Mismatched []ImageMatch `json:"mismatched"`
	Missing    []ImageMiss  `json:"missing"`
}

type ImageMatch struct {
	UUID     string `json:"uuid"`
	Name     string `json:"name"`
	Arch     string `json:"arch"`
	DsymPath string `json:"dsym_path"`
	// Kind differentiates Mismatched reasons: "uuid" (the discovered dSYM's
	// UUID doesn't line up) or "arch" (right UUID, wrong slice). Empty on
	// Matched entries.
	Kind string `json:"kind,omitempty"`
}

type ImageMiss struct {
	UUID   string `json:"uuid"`
	Name   string `json:"name"`
	Arch   string `json:"arch"`
	Reason string `json:"reason"`
}

// RawCrash is the internal (pre-symbolication) shape produced by parsers
// and consumed by the symbolicate/categorize pipeline.
type RawCrash struct {
	Format      string // ips_json_v1 | ips_json_v2 | metrickit_json
	App         AppInfo
	OS          OSInfo
	Arch        string
	Exception   Exception
	Termination Termination
	Threads     []Thread // all threads, flat
	UsedImages  []UsedImage
	CrashedIdx  int // index into Threads
}

type UsedImage struct {
	UUID        string
	Name        string
	Path        string
	LoadAddress uint64
	Size        uint64
	Arch        string
}
