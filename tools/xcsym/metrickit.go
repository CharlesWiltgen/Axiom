package main

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

// ParseMetricKit parses MXCrashDiagnostic.jsonRepresentation() output into a
// RawCrash shape that downstream categorize/symbolicate code can consume
// without branching on format. Accepts both the real nested shape (fields
// under diagnosticMetaData) and a flattened shape (exceptionType at top
// level) — see format_detect.go for which keys trigger FormatMetricKit.
func ParseMetricKit(data []byte) (*RawCrash, error) {
	var doc mxCrashDoc
	if err := json.Unmarshal(data, &doc); err != nil {
		return nil, fmt.Errorf("parse metrickit: %w", err)
	}
	return buildRawCrashFromMetricKit(&doc)
}

// mxCrashDoc mirrors MXCrashDiagnostic.jsonRepresentation(). Both nested
// (diagnosticMetaData) and flattened variants share this shape — the
// diagnosticMetaData block is flattened into MetaData during resolution
// below when it's present.
type mxCrashDoc struct {
	// Nested shape (real MXCrashDiagnostic).
	DiagnosticMetaData *mxMetaData `json:"diagnosticMetaData"`
	// Flattened-shape top-level mirrors — populated when the test/fixture
	// didn't bother with the diagnosticMetaData wrapper.
	ExceptionType        *int    `json:"exceptionType"`
	ExceptionCode        *int    `json:"exceptionCode"`
	Signal               *int    `json:"signal"`
	TerminationReason    string  `json:"terminationReason"`
	OSVersion            string  `json:"osVersion"`
	AppVersion           string  `json:"appVersion"`
	AppBuildVersion      string  `json:"appBuildVersion"`
	PlatformArchitecture string  `json:"platformArchitecture"`
	BundleIdentifier     string  `json:"bundleIdentifier"`
	DeviceType           string  `json:"deviceType"`
	IsTestFlightApp      *bool   `json:"isTestFlightApp"`
	CallStackTree        mxTree  `json:"callStackTree"`
	TimeStampEnd         string  `json:"timeStampEnd"`
}

type mxMetaData struct {
	ExceptionType        *int   `json:"exceptionType"`
	ExceptionCode        *int   `json:"exceptionCode"`
	Signal               *int   `json:"signal"`
	TerminationReason    string `json:"terminationReason"`
	OSVersion            string `json:"osVersion"`
	AppVersion           string `json:"appVersion"`
	AppBuildVersion      string `json:"appBuildVersion"`
	PlatformArchitecture string `json:"platformArchitecture"`
	BundleIdentifier     string `json:"bundleIdentifier"`
	DeviceType           string `json:"deviceType"`
}

type mxTree struct {
	CallStackPerThread bool          `json:"callStackPerThread"`
	CallStacks         []mxCallStack `json:"callStacks"`
}

type mxCallStack struct {
	ThreadAttributed    bool      `json:"threadAttributed"`
	CallStackRootFrames []mxFrame `json:"callStackRootFrames"`
}

type mxFrame struct {
	BinaryUUID                  string      `json:"binaryUUID"`
	OffsetIntoBinaryTextSegment json.Number `json:"offsetIntoBinaryTextSegment"`
	SampleCount                 int         `json:"sampleCount"`
	BinaryName                  string      `json:"binaryName"`
	Address                     json.Number `json:"address"`
	SubFrames                   []mxFrame   `json:"subFrames"`
}

// buildRawCrashFromMetricKit maps the parsed MetricKit doc onto RawCrash.
// The trickiest parts are flattening the frame tree (leaves first so the
// "top of stack" is frame 0, matching .ips convention) and synthesizing
// a UsedImages array from the binaryUUID/binaryName hints sprinkled across
// frames — MetricKit doesn't carry a separate images block.
func buildRawCrashFromMetricKit(doc *mxCrashDoc) (*RawCrash, error) {
	// Resolve metadata from whichever shape the doc used.
	md := resolveMetaData(doc)

	raw := &RawCrash{Format: FormatMetricKit}
	raw.App.BundleID = md.BundleIdentifier
	raw.App.Version = md.AppVersion
	raw.App.Name = extractAppName(md.BundleIdentifier)
	raw.OS.Version = md.OSVersion
	raw.OS.Platform = classifyPlatform(md.OSVersion)
	raw.OS.IsSimulator = strings.Contains(md.OSVersion, "Simulator")
	raw.Arch = md.PlatformArchitecture

	// Exception mapping.
	if md.ExceptionType != nil {
		raw.Exception.Type = exceptionTypeName(*md.ExceptionType)
	}
	if md.Signal != nil {
		raw.Exception.Signal = signalName(*md.Signal)
	}
	raw.Exception.Subtype = md.TerminationReason

	// Termination — parse "Namespace X, Code Y" style terminationReason.
	raw.Termination = parseTerminationReason(md.TerminationReason)
	if md.TerminationReason != "" {
		reason := md.TerminationReason
		raw.Termination.Reason = &reason
	}

	// Threads + UsedImages. Flatten each thread's tree leaf-first so the
	// crash site lands at frame 0 (matching .ips).
	imgByUUID := make(map[string]int) // UUID (uppercase) → index in raw.UsedImages
	raw.UsedImages = nil

	raw.Threads = make([]Thread, 0, len(doc.CallStackTree.CallStacks))
	crashed := -1
	for i, cs := range doc.CallStackTree.CallStacks {
		if cs.ThreadAttributed && crashed == -1 {
			crashed = i
		}
		flat := flattenCallStack(cs.CallStackRootFrames)
		frames := make([]Frame, len(flat))
		for fi, mf := range flat {
			uuid := NormalizeUUID(strings.TrimSpace(mf.BinaryUUID))
			if uuid != "" {
				if _, seen := imgByUUID[uuid]; !seen {
					imgByUUID[uuid] = len(raw.UsedImages)
					raw.UsedImages = append(raw.UsedImages, UsedImage{
						UUID: uuid,
						Name: mf.BinaryName,
						Arch: md.PlatformArchitecture,
					})
				}
			}
			off := int(jsonNumberInt(mf.OffsetIntoBinaryTextSegment))
			frames[fi] = Frame{
				Index:        fi,
				Address:      metrickitFrameAddress(mf),
				Image:        mf.BinaryName,
				ImageOffset:  off,
				Symbolicated: false, // MetricKit has no symbols; symbolicate later
			}
		}
		raw.Threads = append(raw.Threads, Thread{
			Index:     i,
			Triggered: cs.ThreadAttributed,
			Frames:    frames,
		})
	}
	if crashed == -1 {
		// No attributed thread — fall back to thread 0 so downstream code has
		// something consistent. Categorize rules that need the crashed-thread
		// index will degrade gracefully on empty frames.
		if len(raw.Threads) > 0 {
			crashed = 0
			raw.Threads[0].Triggered = true
		}
	}
	raw.CrashedIdx = crashed

	// Arch fallback — if platformArchitecture is absent, use first image's arch.
	if raw.Arch == "" && len(raw.UsedImages) > 0 {
		raw.Arch = raw.UsedImages[0].Arch
	}

	return raw, nil
}

// resolveMetaData merges the nested diagnosticMetaData block (when present)
// with flattened top-level fields. Nested takes precedence because the real
// MXCrashDiagnostic JSON always uses that shape; flat fields only fill gaps.
func resolveMetaData(doc *mxCrashDoc) *mxMetaData {
	out := &mxMetaData{}
	if doc.DiagnosticMetaData != nil {
		*out = *doc.DiagnosticMetaData
	}
	if out.ExceptionType == nil {
		out.ExceptionType = doc.ExceptionType
	}
	if out.ExceptionCode == nil {
		out.ExceptionCode = doc.ExceptionCode
	}
	if out.Signal == nil {
		out.Signal = doc.Signal
	}
	if out.TerminationReason == "" {
		out.TerminationReason = doc.TerminationReason
	}
	if out.OSVersion == "" {
		out.OSVersion = doc.OSVersion
	}
	if out.AppVersion == "" {
		out.AppVersion = doc.AppVersion
	}
	if out.AppBuildVersion == "" {
		out.AppBuildVersion = doc.AppBuildVersion
	}
	if out.PlatformArchitecture == "" {
		out.PlatformArchitecture = doc.PlatformArchitecture
	}
	if out.BundleIdentifier == "" {
		out.BundleIdentifier = doc.BundleIdentifier
	}
	if out.DeviceType == "" {
		out.DeviceType = doc.DeviceType
	}
	return out
}

// flattenCallStack walks the call-stack tree leaves-first so the result
// slice has the crash-site frame at index 0 and outer callers at higher
// indices. This matches .ips convention and lets rules that scan "top N
// frames" fire identically across both formats.
//
// Given:  A → B → C (leaf)  plus sibling root D
// Returns: [C, B, A, D]
func flattenCallStack(roots []mxFrame) []mxFrame {
	var out []mxFrame
	for _, r := range roots {
		out = append(out, flattenTree(r)...)
	}
	return out
}

// flattenTree returns leaves first, then parents. For a chain
// A → B → C, returns [C, B, A]. If a frame has multiple subFrames,
// each child's subtree is emitted in order before the parent.
func flattenTree(f mxFrame) []mxFrame {
	var out []mxFrame
	for _, sf := range f.SubFrames {
		out = append(out, flattenTree(sf)...)
	}
	out = append(out, f)
	return out
}

// exceptionTypeName maps MetricKit's integer exceptionType to the string
// forms categorize rules match against. Unknown values return a visible
// marker so unexpected inputs show up in Reason rather than silently miss.
func exceptionTypeName(t int) string {
	switch t {
	case 1:
		return "EXC_BAD_ACCESS"
	case 2:
		return "EXC_BAD_INSTRUCTION"
	case 3:
		return "EXC_ARITHMETIC"
	case 4:
		return "EXC_EMULATION"
	case 5:
		return "EXC_SOFTWARE"
	case 6:
		return "EXC_BREAKPOINT"
	case 7:
		return "EXC_SYSCALL"
	case 8:
		return "EXC_MACH_SYSCALL"
	case 9:
		return "EXC_RPC_ALERT"
	case 10:
		return "EXC_CRASH"
	case 11:
		return "EXC_RESOURCE"
	case 12:
		return "EXC_GUARD"
	case 13:
		return "EXC_CORPSE_NOTIFY"
	}
	return fmt.Sprintf("EXC_UNKNOWN(%d)", t)
}

// signalName maps POSIX signal numbers to their names, using Darwin
// conventions where they differ from Linux (signal 10 is SIGBUS on Darwin,
// not SIGUSR1). Returns empty for 0 or unknown — we'd rather have an empty
// Signal field than fabricate SIG_UNKNOWN.
func signalName(s int) string {
	switch s {
	case 1:
		return "SIGHUP"
	case 2:
		return "SIGINT"
	case 3:
		return "SIGQUIT"
	case 4:
		return "SIGILL"
	case 5:
		return "SIGTRAP"
	case 6:
		return "SIGABRT"
	case 7:
		return "SIGEMT"
	case 8:
		return "SIGFPE"
	case 9:
		return "SIGKILL"
	case 10:
		return "SIGBUS"
	case 11:
		return "SIGSEGV"
	case 13:
		return "SIGPIPE"
	case 15:
		return "SIGTERM"
	}
	return ""
}

// classifyPlatform collapses Apple's OS-version strings to the short platform
// label used in RawCrash.OS.Platform.
func classifyPlatform(osv string) string {
	switch {
	case strings.Contains(osv, "iPhone OS"), strings.Contains(osv, "iOS"):
		return "iOS"
	case strings.Contains(osv, "macOS"), strings.Contains(osv, "Mac OS X"):
		return "macOS"
	case strings.Contains(osv, "tvOS"):
		return "tvOS"
	case strings.Contains(osv, "watchOS"):
		return "watchOS"
	case strings.Contains(osv, "visionOS"):
		return "visionOS"
	}
	return osv
}

// extractAppName pulls a best-effort app name from the bundle identifier
// (the trailing dot-component). MetricKit doesn't surface the display name
// separately, so "com.example.MyApp" → "MyApp" is our working approximation.
func extractAppName(bundleID string) string {
	if idx := strings.LastIndex(bundleID, "."); idx >= 0 {
		return bundleID[idx+1:]
	}
	return bundleID
}

// terminationRE extracts Namespace and Code fields from Apple's
// "Namespace NS, Code 0x..." terminationReason string.
var terminationRE = regexp.MustCompile(`Namespace\s+([A-Z_]+)(?:,\s*Code\s+(\S+))?`)

// parseTerminationReason extracts the categorize-rule-relevant namespace+code
// from a human-readable terminationReason string. Returns a zero-value
// Termination when no structure is detectable so callers can still stuff the
// raw text into Reason for display.
func parseTerminationReason(reason string) Termination {
	var t Termination
	if m := terminationRE.FindStringSubmatch(reason); m != nil {
		t.Namespace = m[1]
		if len(m) > 2 {
			t.Code = strings.TrimSuffix(m[2], ",")
		}
	}
	return t
}

// metrickitFrameAddress returns the absolute address field if MetricKit
// emitted one, otherwise "" (symbolicate will skip it).
func metrickitFrameAddress(f mxFrame) string {
	s := f.Address.String()
	if s == "" {
		return ""
	}
	if v, err := parseHexOrDec(s); err == nil {
		return fmt.Sprintf("0x%x", v)
	}
	return ""
}
