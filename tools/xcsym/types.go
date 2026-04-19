package main

// CrashReport is the top-level structured output of `xcsym crash`.
type CrashReport struct {
	Tool        string      `json:"tool"`
	Version     string      `json:"version"`
	Format      string      `json:"format"` // summary | standard | full
	Environment Environment `json:"environment"`
	Input       InputInfo   `json:"input"`
	Crash       CrashInfo   `json:"crash"`
	Images      ImageStatus `json:"images"`
	Warnings    []string    `json:"warnings"`
	SizeWarning *string     `json:"size_warning,omitempty"`
}

type Environment struct {
	AtosVersion          string `json:"atos_version"`
	CLTVersion           string `json:"clt_version"`
	SwiftDemangleVersion string `json:"swift_demangle_version"`
	HostArch             string `json:"host_arch"`
	XcodePath            string `json:"xcode_path"`
}

type InputInfo struct {
	Path   string `json:"path"`
	Format string `json:"format"` // ips_json_v1 | ips_json_v2 | metrickit_json
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
	Reason    *string `json:"reason"`
}

type Thread struct {
	Index     int     `json:"index"`
	Triggered bool    `json:"triggered"`
	Frames    []Frame `json:"frames"`
}

type ThreadTop struct {
	Index  int     `json:"index"`
	Frames []Frame `json:"frames"`
}

type Frame struct {
	Index        int    `json:"index"`
	Address      string `json:"address"`
	Image        string `json:"image"`
	ImageOffset  int    `json:"image_offset,omitempty"`
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
