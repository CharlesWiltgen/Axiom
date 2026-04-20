package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// HangError is returned by ParseIPS when the crash file is actually a hang
// report (bug_type 298 on Apple platforms). Hangs have no exception frame and
// shouldn't flow through the normal symbolicate/categorize pipeline — the
// crash subcommand catches this and exits 1 with a routing hint.
type HangError struct {
	BugType string
}

func (e *HangError) Error() string {
	return "crash file is a hang report (bug_type=" + e.BugType + "); not a crash — use a hang analyzer"
}

// ParseIPS detects and parses .ips crash reports (both v1 single-blob and v2
// two-line header+payload layouts). Returns a *HangError for hang-type reports
// so the caller can short-circuit.
func ParseIPS(data []byte) (*RawCrash, error) {
	format := DetectFormat(data)
	switch format {
	case FormatIPSv1:
		return ParseIPSv1(data)
	case FormatIPSv2:
		idx := bytes.IndexByte(data, '\n')
		if idx <= 0 {
			return nil, fmt.Errorf("ips_json_v2: missing newline between header and payload")
		}
		return ParseIPSv2(bytes.TrimSpace(data[:idx]), bytes.TrimSpace(data[idx+1:]))
	case FormatMetricKit:
		return nil, fmt.Errorf("ParseIPS: MetricKit format — call ParseMetricKit instead")
	}
	return nil, fmt.Errorf("ParseIPS: unsupported or unrecognized format")
}

// ParseIPSv1 parses a single-blob v1 .ips file. All fields (header metadata +
// crash payload) sit at the JSON top level.
func ParseIPSv1(data []byte) (*RawCrash, error) {
	var h ipsHeader
	if err := json.Unmarshal(data, &h); err != nil {
		return nil, fmt.Errorf("parse ips v1 header fields: %w", err)
	}
	if err := checkHang(&h); err != nil {
		return nil, err
	}
	var p ipsPayload
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("parse ips v1 payload: %w", err)
	}
	return buildRawCrash(FormatIPSv1, &h, &p)
}

// ParseIPSv2 parses the two-line v2 layout (header JSON then payload JSON).
func ParseIPSv2(header, payload []byte) (*RawCrash, error) {
	var h ipsHeader
	if err := json.Unmarshal(header, &h); err != nil {
		return nil, fmt.Errorf("parse ips v2 header: %w", err)
	}
	if err := checkHang(&h); err != nil {
		return nil, err
	}
	var p ipsPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return nil, fmt.Errorf("parse ips v2 payload: %w", err)
	}
	return buildRawCrash(FormatIPSv2, &h, &p)
}

// checkHang inspects the header's bug_type for hang reports. Apple uses 298
// for spin/hang reports; they carry no exception and shouldn't reach
// categorize rules.
func checkHang(h *ipsHeader) error {
	if h.BugType == "298" {
		return &HangError{BugType: h.BugType}
	}
	return nil
}

// ipsHeader captures fields that appear in the v2 header line and at the
// v1 JSON top level. Both snake_case (v1 convention) and camelCase (v2
// convention) field names are tolerated.
type ipsHeader struct {
	AppName      string `json:"app_name"`
	AppVersion   string `json:"app_version"`
	BundleID     string `json:"bundleID"`
	BundleIDAlt  string `json:"bundle_id"` // v1 spelling
	BuildVersion string `json:"build_version"`
	BugType      string `json:"bug_type"`
	OSVersion    string `json:"os_version"`
	Timestamp    string `json:"timestamp"`
	Name         string `json:"name"`
}

// ipsPayload captures fields from the v2 payload line (or v1 top level).
// Only fields Phase 6 needs to populate RawCrash are declared; everything else
// is ignored during json.Unmarshal.
type ipsPayload struct {
	ProcName    string            `json:"procName"`
	ProcPath    string            `json:"procPath"`
	CPUType     string            `json:"cpuType"`
	ModelCode   string            `json:"modelCode"`
	OSVersion   *ipsOSVersionV2   `json:"osVersion"`
	BundleInfo  *ipsBundleInfo    `json:"bundleInfo"`
	Exception   *ipsException     `json:"exception"`
	Termination *ipsTermination   `json:"termination"`
	FaultingThr *int              `json:"faultingThread"`
	Threads     []ipsThread       `json:"threads"`
	UsedImages  []rawUsedImage    `json:"usedImages"`

	// v1 mirrors — present at top level of v1 blobs only.
	AppName    string `json:"app_name"`
	AppVersion string `json:"app_version"`
	BundleID   string `json:"bundle_id"`
	BugType    string `json:"bug_type"`
	OSVerStr   string `json:"os_version"`
}

type ipsException struct {
	Type    string `json:"type"`
	Codes   string `json:"codes"`
	Subtype string `json:"subtype"`
	Signal  string `json:"signal"`
}

type ipsTermination struct {
	Namespace string          `json:"namespace"`
	Code      json.RawMessage `json:"code"`   // int or string
	Reason    json.RawMessage `json:"reason"` // string or array of strings
	Indicator string          `json:"indicator"`
	ByProc    string          `json:"byProc"`
}

type ipsThread struct {
	Triggered   bool            `json:"triggered"`
	Queue       string          `json:"queue"`
	Name        string          `json:"name"`
	Frames      []ipsFrame      `json:"frames"`
	ThreadState *ipsThreadState `json:"threadState"`
}

type ipsFrame struct {
	ImageOffset    json.Number `json:"imageOffset"`
	Symbol         string      `json:"symbol"`
	SymbolLocation json.Number `json:"symbolLocation"`
	ImageIndex     int         `json:"imageIndex"`
	SourceFile     string      `json:"sourceFile"`
	SourceLine     int         `json:"sourceLine"`
}

type ipsThreadState struct {
	PC *ipsReg `json:"pc"`
	SP *ipsReg `json:"sp"`
}

type ipsReg struct {
	Value json.Number `json:"value"`
}

type ipsOSVersionV2 struct {
	Train       string `json:"train"`
	Build       string `json:"build"`
	ReleaseType string `json:"releaseType"`
}

type ipsBundleInfo struct {
	ShortVersion string `json:"CFBundleShortVersionString"`
	Version      string `json:"CFBundleVersion"`
	Identifier   string `json:"CFBundleIdentifier"`
}

// buildRawCrash maps the parsed header+payload onto the RawCrash shape used
// by symbolicate and categorize. Field resolution prefers v2 conventions
// (bundleInfo > header.BundleID) but falls back to v1 (bundle_id) so a single
// function serves both formats.
func buildRawCrash(format string, h *ipsHeader, p *ipsPayload) (*RawCrash, error) {
	raw := &RawCrash{Format: format}

	// App metadata — prefer bundleInfo (v2), then header (v2/v1), then payload mirrors.
	raw.App.Name = firstNonEmpty(h.AppName, p.AppName, p.ProcName, h.Name)
	raw.App.Version = firstNonEmpty(p.bundleShort(), h.AppVersion, p.AppVersion)
	raw.App.BundleID = firstNonEmpty(p.bundleID(), h.BundleID, h.BundleIDAlt, p.BundleID)

	// OS info.
	raw.OS.Platform = detectPlatform(h, p)
	raw.OS.Version = osVersionString(h, p)
	raw.OS.Build = osBuildString(p)
	raw.OS.IsSimulator = detectSimulator(h, p)

	// Arch — prefer cpuType, then first image arch.
	raw.Arch = canonicalArch(p.CPUType)
	if raw.Arch == "" && len(p.UsedImages) > 0 {
		raw.Arch = p.UsedImages[0].Arch
	}

	// Exception / termination.
	if p.Exception != nil {
		raw.Exception = Exception{
			Type:    p.Exception.Type,
			Codes:   p.Exception.Codes,
			Subtype: p.Exception.Subtype,
			Signal:  p.Exception.Signal,
		}
	}
	if p.Termination != nil {
		raw.Termination = Termination{
			Namespace: p.Termination.Namespace,
			Code:      renderTerminationCode(p.Termination),
			Reason:    renderTerminationReason(p.Termination),
		}
	}

	// Used images — rely on the existing parse_images code path for UUID
	// normalization and empty-UUID filtering, but also copy over LoadAddress
	// and Size (parse_images dropped those in Phase 4).
	raw.UsedImages = make([]UsedImage, 0, len(p.UsedImages))
	for _, img := range p.UsedImages {
		uuid := NormalizeUUID(strings.TrimSpace(img.UUID))
		if uuid == "" {
			continue
		}
		raw.UsedImages = append(raw.UsedImages, UsedImage{
			UUID:        uuid,
			Name:        img.Name,
			Path:        img.Path,
			Arch:        img.Arch,
			LoadAddress: parseUintFlexible(img.Base),
			Size:        parseUintFlexible(img.Size),
		})
	}

	// Threads — preserve source order; imageIndex lookup happens against the
	// ORIGINAL payload.UsedImages array (including any dropped empty-UUID
	// entries) so frame.Image matches what the source .ips intended.
	raw.Threads = make([]Thread, len(p.Threads))
	for i, t := range p.Threads {
		th := Thread{Index: i, Triggered: t.Triggered}
		if t.ThreadState != nil {
			th.State = &ThreadState{
				PC: parseRegValue(t.ThreadState.PC),
				SP: parseRegValue(t.ThreadState.SP),
			}
		}
		th.Frames = make([]Frame, 0, len(t.Frames))
		for fi, f := range t.Frames {
			th.Frames = append(th.Frames, Frame{
				Index:        fi,
				Address:      frameAddress(p.UsedImages, f),
				Image:        frameImageName(p.UsedImages, f.ImageIndex),
				UUID:         frameImageUUID(p.UsedImages, f.ImageIndex),
				ImageOffset:  int(jsonNumberInt(f.ImageOffset)),
				Symbol:       f.Symbol,
				File:         f.SourceFile,
				Line:         f.SourceLine,
				Symbolicated: f.Symbol != "",
			})
		}
		raw.Threads[i] = th
	}

	// CrashedIdx — prefer explicit faultingThread, else first triggered.
	raw.CrashedIdx = -1
	if p.FaultingThr != nil && *p.FaultingThr >= 0 && *p.FaultingThr < len(raw.Threads) {
		raw.CrashedIdx = *p.FaultingThr
	} else {
		for i, t := range raw.Threads {
			if t.Triggered {
				raw.CrashedIdx = i
				break
			}
		}
	}
	if raw.CrashedIdx < 0 && len(raw.Threads) > 0 {
		raw.CrashedIdx = 0
	}
	// Mark the crashed thread triggered even when source .ips didn't set it
	// explicitly (some v1 hand-rolled files leave the flag off).
	if raw.CrashedIdx >= 0 && raw.CrashedIdx < len(raw.Threads) {
		raw.Threads[raw.CrashedIdx].Triggered = true
	}

	return raw, nil
}

// --- field helpers -----------------------------------------------------

func (p *ipsPayload) bundleShort() string {
	if p.BundleInfo != nil {
		return p.BundleInfo.ShortVersion
	}
	return ""
}

func (p *ipsPayload) bundleID() string {
	if p.BundleInfo != nil {
		return p.BundleInfo.Identifier
	}
	return ""
}

func firstNonEmpty(vs ...string) string {
	for _, v := range vs {
		if v != "" {
			return v
		}
	}
	return ""
}

// canonicalArch maps Apple's cpuType string into the arch token that
// dSYM discovery / dwarfdump uses. Unknown values return "" so downstream
// logic can fall back to first-image arch.
func canonicalArch(cpu string) string {
	switch strings.ToUpper(cpu) {
	case "ARM-64", "ARM64":
		return "arm64"
	case "ARM-64E", "ARM64E":
		return "arm64e"
	case "X86-64", "X86_64":
		return "x86_64"
	case "":
		return ""
	default:
		return strings.ToLower(cpu)
	}
}

// detectPlatform produces a compact platform label for OSInfo.Platform.
// Drawn from the v1 "os_version" string when nothing more structured exists.
func detectPlatform(h *ipsHeader, p *ipsPayload) string {
	src := firstNonEmpty(h.OSVersion, p.OSVerStr)
	switch {
	case strings.Contains(src, "iPhone OS"), strings.Contains(src, "iOS"):
		return "iOS"
	case strings.Contains(src, "macOS"), strings.Contains(src, "Mac OS X"):
		return "macOS"
	case strings.Contains(src, "tvOS"):
		return "tvOS"
	case strings.Contains(src, "watchOS"):
		return "watchOS"
	case strings.Contains(src, "visionOS"):
		return "visionOS"
	}
	return src
}

func osVersionString(h *ipsHeader, p *ipsPayload) string {
	if p.OSVersion != nil && p.OSVersion.Train != "" {
		return p.OSVersion.Train
	}
	return firstNonEmpty(h.OSVersion, p.OSVerStr)
}

func osBuildString(p *ipsPayload) string {
	if p.OSVersion != nil {
		return p.OSVersion.Build
	}
	return ""
}

// detectSimulator returns true when any of the strong simulator markers
// appear. procPath containing "/CoreSimulator/" is Apple's canonical signal;
// modelCode or os_version mentioning "Simulator" are secondary heuristics.
func detectSimulator(h *ipsHeader, p *ipsPayload) bool {
	if strings.Contains(p.ProcPath, "/CoreSimulator/") {
		return true
	}
	if strings.Contains(p.ModelCode, "Simulator") {
		return true
	}
	if strings.Contains(h.OSVersion, "Simulator") {
		return true
	}
	return false
}

// renderTerminationCode normalizes the termination.code field which .ips
// files render as either an integer (e.g. 2343432205 for 0x8BADF00D) or a
// quoted hex string. Output is always "0x<lowerhex>" so EqualFold matches
// in categorize rules work consistently.
func renderTerminationCode(t *ipsTermination) string {
	raw := bytes.TrimSpace(t.Code)
	if len(raw) == 0 || bytes.Equal(raw, []byte("null")) {
		// No code on the payload; fall back to the indicator (often carries
		// the hex code in parens, e.g. "0x8BADF00D (watchdog)").
		if idx := strings.Index(t.Indicator, "0x"); idx >= 0 {
			end := idx
			for end < len(t.Indicator) && isHexDigit(t.Indicator[end]) {
				end++
			}
			if end == idx+2 {
				// "0x" with no following hex; fall through to empty.
				return ""
			}
			return strings.ToLower(t.Indicator[idx:end])
		}
		return ""
	}
	// String form: strip quotes, return as-is.
	if raw[0] == '"' {
		var s string
		if err := json.Unmarshal(raw, &s); err == nil {
			return s
		}
	}
	// Numeric form: unmarshal into int64 (handles negatives for signed kernel
	// codes) and render as hex. Large unsigned values (> int64 max) are rare
	// here but we also try uint64 as a fallback.
	var i int64
	if err := json.Unmarshal(raw, &i); err == nil {
		if i < 0 {
			return "0x" + strconv.FormatUint(uint64(i), 16)
		}
		return "0x" + strconv.FormatInt(i, 16)
	}
	var u uint64
	if err := json.Unmarshal(raw, &u); err == nil {
		return "0x" + strconv.FormatUint(u, 16)
	}
	return string(raw)
}

func isHexDigit(b byte) bool {
	return (b >= '0' && b <= '9') || (b >= 'a' && b <= 'f') || (b >= 'A' && b <= 'F')
}

// renderTerminationReason handles the reason field which is sometimes a
// string, sometimes an array of strings, sometimes absent. Returns nil when
// no reason was present so downstream JSON doesn't emit a spurious key.
func renderTerminationReason(t *ipsTermination) *string {
	raw := bytes.TrimSpace(t.Reason)
	if len(raw) == 0 || bytes.Equal(raw, []byte("null")) {
		return nil
	}
	if raw[0] == '"' {
		var s string
		if err := json.Unmarshal(raw, &s); err == nil && s != "" {
			return &s
		}
		return nil
	}
	if raw[0] == '[' {
		var arr []string
		if err := json.Unmarshal(raw, &arr); err == nil && len(arr) > 0 {
			s := strings.Join(arr, "\n")
			return &s
		}
		return nil
	}
	// Any other shape: stringify verbatim for visibility.
	s := string(raw)
	return &s
}

// frameAddress formats a frame's absolute address from the image's load
// address plus the frame's image offset. atos consumes this form as-is.
func frameAddress(images []rawUsedImage, f ipsFrame) string {
	if f.ImageIndex < 0 || f.ImageIndex >= len(images) {
		return ""
	}
	base := parseUintFlexible(images[f.ImageIndex].Base)
	off := uint64(jsonNumberInt(f.ImageOffset))
	return fmt.Sprintf("0x%x", base+off)
}

// frameImageName resolves an imageIndex against the payload's usedImages
// array. Returns "" when the index is out of range — some .ips files carry
// garbage indexes on kernel-stub frames.
func frameImageName(images []rawUsedImage, idx int) string {
	if idx < 0 || idx >= len(images) {
		return ""
	}
	return images[idx].Name
}

// frameImageUUID returns the normalized UUID for the usedImage at imageIndex
// so Frame.UUID can be populated at parse time. Out-of-range or empty-UUID
// entries return "" — symbolicate skips such frames rather than misattributing
// them.
func frameImageUUID(images []rawUsedImage, idx int) string {
	if idx < 0 || idx >= len(images) {
		return ""
	}
	return NormalizeUUID(strings.TrimSpace(images[idx].UUID))
}

// parseUintFlexible handles the variety of encodings Apple uses for numeric
// fields in .ips files. base/size show up as ints most of the time but have
// occasionally appeared as quoted strings in older spellings.
func parseUintFlexible(raw json.RawMessage) uint64 {
	if len(raw) == 0 {
		return 0
	}
	if raw[0] == '"' {
		var s string
		if err := json.Unmarshal(raw, &s); err == nil {
			if v, err := parseHexOrDec(s); err == nil {
				return v
			}
		}
		return 0
	}
	var u uint64
	if err := json.Unmarshal(raw, &u); err == nil {
		return u
	}
	var i int64
	if err := json.Unmarshal(raw, &i); err == nil && i >= 0 {
		return uint64(i)
	}
	return 0
}

func parseHexOrDec(s string) (uint64, error) {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "0x") || strings.HasPrefix(s, "0X") {
		return strconv.ParseUint(s[2:], 16, 64)
	}
	return strconv.ParseUint(s, 10, 64)
}

func parseRegValue(r *ipsReg) uint64 {
	if r == nil {
		return 0
	}
	s := r.Value.String()
	if s == "" {
		return 0
	}
	if v, err := parseHexOrDec(s); err == nil {
		return v
	}
	// Signed representation — accept negatives (shouldn't happen for SP/PC
	// but defensive against weird fixtures).
	var i int64
	if err := json.Unmarshal([]byte(s), &i); err == nil {
		return uint64(i)
	}
	return 0
}

// jsonNumberInt returns n as an int64, handling both integer and numeric
// string encodings. Zero on unparseable input.
func jsonNumberInt(n json.Number) int64 {
	if n == "" {
		return 0
	}
	if i, err := n.Int64(); err == nil {
		return i
	}
	if f, err := n.Float64(); err == nil {
		return int64(f)
	}
	return 0
}
