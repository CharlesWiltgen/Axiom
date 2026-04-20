package main

import (
	"bufio"
	"bytes"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// ParseAppleCrash parses Apple's legacy .crash text format — the one Xcode
// Organizer exposes via "Show in Finder" on a TestFlight crash. Layout:
//
//  1. Header block — "Key: value" lines (Process, Version, OS Version,
//     Exception Type, Triggered by Thread, …) until a blank line or a
//     known section marker.
//  2. Optional "Last Exception Backtrace:" — ObjC exception frames,
//     duplicated in the matching "Thread N Crashed:" block below.
//     Skipped during parsing to avoid frame duplication.
//  3. "Thread N:" and "Thread N Crashed:" sections — each is the index,
//     optional name, and a sequence of frame lines.
//  4. "Thread N crashed with <arch> Thread State:" — register block whose
//     sp/pc values feed R-stack-overflow-01.
//  5. "Binary Images:" — per-image entries with base addr, end addr,
//     name, arch, UUID, and path.
//
// The parser is lenient: blank lines, missing sections, and reordered
// headers are tolerated as long as the key tokens above are recognized.
// Returns a *HangError if the report is a hang (bug_type=298 equivalent
// in the text format — we flag it off "Exception Type" being empty while
// "Triggered by Thread" is set, though in practice hangs don't emit the
// .crash text layout, so this rarely fires).
func ParseAppleCrash(data []byte) (*RawCrash, error) {
	raw := &RawCrash{Format: FormatAppleCrash, CrashedIdx: -1}

	sections, err := splitAppleCrashSections(data)
	if err != nil {
		return nil, fmt.Errorf("apple_crash: %w", err)
	}

	// Header metadata drives App/OS/Arch/Exception/Termination fields.
	applyAppleCrashHeader(raw, sections.header)

	// Binary Images — parsed before threads so UsedImages is populated
	// when we need to line up frame addresses with base addresses.
	for _, line := range sections.binaryImages {
		if img, ok := parseAppleCrashImageLine(line); ok {
			raw.UsedImages = append(raw.UsedImages, img)
		}
	}

	// Threads — each chunk begins with "Thread N:" or "Thread N Crashed:".
	for _, chunk := range sections.threads {
		th, crashed := parseAppleCrashThread(chunk, raw.UsedImages)
		raw.Threads = append(raw.Threads, th)
		if crashed && raw.CrashedIdx == -1 {
			raw.CrashedIdx = th.Index
		}
	}

	// Register state — attach to the thread named in "Thread N crashed
	// with <arch> Thread State:". Happens after thread parsing so we can
	// index into raw.Threads by the announced thread number.
	if sections.threadStateIdx >= 0 {
		if state := parseAppleCrashThreadState(sections.threadState); state != nil {
			for i := range raw.Threads {
				if raw.Threads[i].Index == sections.threadStateIdx {
					raw.Threads[i].State = state
					break
				}
			}
		}
	}

	// Fall back to "first triggered" → "first thread" → -1 if no
	// crashed thread was identified from the section headers. Then
	// mark the crashed thread triggered so categorize rules that look
	// for Thread.Triggered find it.
	if raw.CrashedIdx == -1 {
		for i, t := range raw.Threads {
			if t.Triggered {
				raw.CrashedIdx = i
				break
			}
		}
	}
	if raw.CrashedIdx == -1 && len(raw.Threads) > 0 {
		raw.CrashedIdx = 0
	}
	if raw.CrashedIdx >= 0 && raw.CrashedIdx < len(raw.Threads) {
		raw.Threads[raw.CrashedIdx].Triggered = true
	}

	return raw, nil
}

// --- Section splitter ---------------------------------------------------

// appleCrashSections is the intermediate representation between line
// scanning and field-level parsing. Each field corresponds to one of the
// top-level sections of the .crash layout.
type appleCrashSections struct {
	header         map[string]string
	threads        [][]string
	threadState    []string
	threadStateIdx int
	binaryImages   []string
}

// threadHeaderRE matches the line that starts a thread chunk:
//
//	"Thread 0:"
//	"Thread 3 Crashed:"
//
// The optional " Crashed" suffix flags the crashed thread. Lines like
// "Thread N name: <label>" are ignored by this regex — the thread name
// is metadata we don't store on Thread today (the ips parser doesn't
// either), and treating "name:" lines as section boundaries would
// create empty chunks.
var appleCrashThreadHeaderRE = regexp.MustCompile(`^Thread (\d+)( Crashed)?:\s*$`)

// threadStateHeaderRE matches "Thread N crashed with ARM Thread State
// (64-bit):" and variants (x86, 32-bit, Intel). We only capture the
// thread index; the arch is already known from the header.
var appleCrashThreadStateHeaderRE = regexp.MustCompile(`^Thread (\d+) crashed with [^:]+:\s*$`)

// splitAppleCrashSections walks the file once and partitions lines into
// header key:value pairs, per-thread frame chunks, register state lines,
// and Binary Images lines. Tolerates blank lines and the optional
// "Last Exception Backtrace:" section (skipped — its frames duplicate
// the crashed thread's frames).
func splitAppleCrashSections(data []byte) (*appleCrashSections, error) {
	s := &appleCrashSections{
		header:         make(map[string]string),
		threadStateIdx: -1,
	}

	sc := bufio.NewScanner(bytes.NewReader(data))
	// Large buffer — fully populated .crash files regularly reach 200+ KB
	// in the Thread N sections on apps with many worker threads.
	sc.Buffer(make([]byte, 0, 64*1024), 10*1024*1024)

	var lines []string
	for sc.Scan() {
		lines = append(lines, sc.Text())
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("scan: %w", err)
	}

	// PHASE 1 — Header. Walk until we see a thread header, the last
	// exception backtrace marker, or the Binary Images section. Header
	// lines are "Key: value" pairs; we preserve the raw value (no
	// trimming beyond leading spaces) so callers that need columnar
	// parsing get it back unchanged.
	i := 0
	for ; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed == "" {
			continue
		}
		if strings.HasPrefix(trimmed, "Last Exception Backtrace:") ||
			strings.HasPrefix(trimmed, "Binary Images:") ||
			appleCrashThreadHeaderRE.MatchString(trimmed) ||
			appleCrashThreadStateHeaderRE.MatchString(trimmed) {
			break
		}
		if k, v, ok := splitHeaderLine(trimmed); ok {
			// Prefer the FIRST occurrence of a key. Some reports repeat
			// keys with empty or noisier values (e.g. "Version:" may
			// appear again inside a sub-section). First wins — that's
			// the authoritative top-level header.
			if _, exists := s.header[k]; !exists {
				s.header[k] = v
			}
		}
	}

	// PHASE 2 — Skip Last Exception Backtrace if present. Its frames
	// duplicate the crashed thread's frames (post-Xcode 9); keeping
	// them would inflate the symbolicate workload and confuse the
	// categorizer's "crashed thread" semantics.
	for i < len(lines) {
		trimmed := strings.TrimSpace(lines[i])
		if !strings.HasPrefix(trimmed, "Last Exception Backtrace:") {
			break
		}
		i++ // consume the header line
		for ; i < len(lines); i++ {
			cur := strings.TrimSpace(lines[i])
			if cur == "" {
				break
			}
			if appleCrashThreadHeaderRE.MatchString(cur) ||
				strings.HasPrefix(cur, "Binary Images:") ||
				appleCrashThreadStateHeaderRE.MatchString(cur) {
				break
			}
		}
	}

	// PHASE 3 — Thread chunks + register state. Continue until we hit
	// "Binary Images:" (which is always terminal in the layout Apple
	// emits today).
	for i < len(lines) {
		trimmed := strings.TrimSpace(lines[i])
		if strings.HasPrefix(trimmed, "Binary Images:") {
			i++
			break
		}
		if m := appleCrashThreadStateHeaderRE.FindStringSubmatch(trimmed); m != nil {
			idx, _ := strconv.Atoi(m[1])
			s.threadStateIdx = idx
			i++ // consume the state header
			for ; i < len(lines); i++ {
				cur := strings.TrimSpace(lines[i])
				if cur == "" {
					break
				}
				if strings.HasPrefix(cur, "Binary Images:") {
					break
				}
				s.threadState = append(s.threadState, lines[i])
			}
			continue
		}
		if m := appleCrashThreadHeaderRE.FindStringSubmatch(trimmed); m != nil {
			// New thread chunk. Consume everything up to the next thread
			// boundary, register block, Binary Images section, or EOF.
			chunk := []string{lines[i]}
			i++
			for ; i < len(lines); i++ {
				cur := strings.TrimSpace(lines[i])
				if appleCrashThreadHeaderRE.MatchString(cur) ||
					appleCrashThreadStateHeaderRE.MatchString(cur) ||
					strings.HasPrefix(cur, "Binary Images:") {
					break
				}
				chunk = append(chunk, lines[i])
			}
			s.threads = append(s.threads, chunk)
			continue
		}
		// Anything else in this phase (including "Thread N name:" lines
		// and blank separators) is metadata we don't need.
		i++
	}

	// PHASE 4 — Binary Images, everything until EOF or a literal "EOF"
	// trailer Apple sometimes adds.
	for ; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed == "" || trimmed == "EOF" {
			continue
		}
		s.binaryImages = append(s.binaryImages, lines[i])
	}

	return s, nil
}

// splitHeaderLine parses "Key: value" where the colon is the first on the
// line (values may contain colons, e.g. "iPhone OS 26.4.1 (23E254)").
// Returns ("", "", false) on any line that doesn't have a colon or whose
// key is empty after trimming.
func splitHeaderLine(line string) (string, string, bool) {
	idx := strings.Index(line, ":")
	if idx < 0 {
		return "", "", false
	}
	key := strings.TrimSpace(line[:idx])
	if key == "" {
		return "", "", false
	}
	val := strings.TrimSpace(line[idx+1:])
	return key, val, true
}

// --- Header mapping -----------------------------------------------------

// applyAppleCrashHeader populates raw.App / raw.OS / raw.Arch /
// raw.Exception / raw.Termination from the parsed header map. Each field
// is derived from one or more keys; missing keys leave the corresponding
// field at its zero value so categorize rules that check for a specific
// value won't accidentally fire.
func applyAppleCrashHeader(raw *RawCrash, h map[string]string) {
	// App name: "Process:" line is "AppName [pid]". Strip the pid.
	if v, ok := h["Process"]; ok {
		raw.App.Name = stripProcessPID(v)
	}
	// Fall back to "Path:" (e.g. "/…/AppName.app/AppName") if Process
	// was absent or malformed.
	if raw.App.Name == "" {
		if v, ok := h["Path"]; ok {
			raw.App.Name = pathAppName(v)
		}
	}
	raw.App.Version = h["Version"]
	raw.App.BundleID = h["Identifier"]

	// OS: "OS Version:" is usually "iPhone OS X.Y.Z (build)"; keep the
	// platform prefix + version, capture the build code separately.
	if v, ok := h["OS Version"]; ok {
		raw.OS.Platform = platformFromAppleCrashOS(v)
		raw.OS.Version = versionFromAppleCrashOS(v)
		raw.OS.Build = buildFromAppleCrashOS(v)
	}
	// IsSimulator: Path under /CoreSimulator/ (same signal the ips
	// parser uses). "Hardware Model: Simulator" would be another
	// signal but the Simulator emits the same Hardware Model its host
	// uses, so Path is more reliable.
	if v, ok := h["Path"]; ok && strings.Contains(v, "/CoreSimulator/") {
		raw.OS.IsSimulator = true
	}

	// Arch from "Code Type:" ("ARM-64 (Native)" / "X86-64" / "ARM-64e").
	if v, ok := h["Code Type"]; ok {
		// "ARM-64 (Native)" → "ARM-64"; strip parenthetical before
		// handing to canonicalArch.
		codeType := v
		if idx := strings.Index(codeType, " ("); idx > 0 {
			codeType = codeType[:idx]
		}
		raw.Arch = canonicalArch(strings.TrimSpace(codeType))
	}
	// Fall back to the first image's arch when Code Type is missing —
	// matches the ips parser's fallback chain.
	if raw.Arch == "" && len(raw.UsedImages) > 0 {
		raw.Arch = raw.UsedImages[0].Arch
	}

	// Exception: "Exception Type:" often has the form "EXC_CRASH (SIGABRT)"
	// — split the parenthetical into Signal.
	if v, ok := h["Exception Type"]; ok {
		raw.Exception.Type, raw.Exception.Signal = splitExceptionType(v)
	}
	raw.Exception.Codes = h["Exception Codes"]
	raw.Exception.Subtype = h["Exception Subtype"]

	// Termination: "Termination Reason:" has several forms across OS
	// versions; applyAppleCrashTermination normalizes them.
	applyAppleCrashTermination(raw, h)
}

// stripProcessPID removes the " [pid]" tail from the Process header
// value. "Poppy [14250]" → "Poppy". Tolerates missing brackets.
func stripProcessPID(v string) string {
	if idx := strings.Index(v, " ["); idx > 0 {
		return v[:idx]
	}
	return v
}

// pathAppName extracts the app name from a bundle path when Process is
// absent. "/…/Poppy.app/Poppy" → "Poppy". Returns "" for paths that
// don't look like app bundles.
func pathAppName(v string) string {
	if idx := strings.LastIndex(v, ".app/"); idx > 0 {
		tail := v[idx+5:] // past ".app/"
		// Strip anything past the next slash (macOS: "Contents/MacOS/App").
		if slash := strings.Index(tail, "/"); slash > 0 {
			return tail[:slash]
		}
		return tail
	}
	return ""
}

// platformFromAppleCrashOS reads "iPhone OS 26.4.1 (23E254)" etc. and
// returns the canonical platform label ("iOS", "macOS", "tvOS",
// "watchOS", "visionOS"). Falls back to the raw value when no known
// prefix matches.
func platformFromAppleCrashOS(v string) string {
	switch {
	case strings.HasPrefix(v, "iPhone OS"), strings.HasPrefix(v, "iOS"):
		return "iOS"
	case strings.HasPrefix(v, "Mac OS X"), strings.HasPrefix(v, "macOS"):
		return "macOS"
	case strings.HasPrefix(v, "tvOS"):
		return "tvOS"
	case strings.HasPrefix(v, "Watch OS"), strings.HasPrefix(v, "watchOS"):
		return "watchOS"
	case strings.HasPrefix(v, "visionOS"), strings.HasPrefix(v, "xrOS"):
		return "visionOS"
	}
	return v
}

// versionFromAppleCrashOS extracts the numeric version from an OS line.
// "iPhone OS 26.4.1 (23E254)" → "26.4.1". Returns the raw value when
// the format doesn't match.
var appleCrashOSVersionRE = regexp.MustCompile(`(\d+(?:\.\d+){0,2})`)

func versionFromAppleCrashOS(v string) string {
	if m := appleCrashOSVersionRE.FindStringSubmatch(v); m != nil {
		return m[1]
	}
	return v
}

// buildFromAppleCrashOS pulls the build code out of the trailing
// parenthetical in an OS line. "iPhone OS 26.4.1 (23E254)" → "23E254".
func buildFromAppleCrashOS(v string) string {
	if open := strings.LastIndex(v, "("); open >= 0 {
		if close := strings.LastIndex(v, ")"); close > open {
			return strings.TrimSpace(v[open+1 : close])
		}
	}
	return ""
}

// splitExceptionType pulls Signal out of the "Exception Type" value's
// parenthetical.
//
//	"EXC_CRASH (SIGABRT)" → ("EXC_CRASH", "SIGABRT")
//	"EXC_BAD_ACCESS"      → ("EXC_BAD_ACCESS", "")
func splitExceptionType(v string) (typ, signal string) {
	v = strings.TrimSpace(v)
	open := strings.Index(v, " (")
	if open < 0 {
		return v, ""
	}
	typ = strings.TrimSpace(v[:open])
	signal = v[open+2:]
	signal = strings.TrimSuffix(signal, ")")
	signal = strings.TrimSpace(signal)
	return typ, signal
}

// applyAppleCrashTermination normalizes the several Termination-line
// forms Apple has used:
//
//	"SIGNAL 6 Abort trap: 6"                          → ns=SIGNAL, code=0x6
//	"Namespace FRONTBOARD, Code 0x8BADF00D"           → ns=FRONTBOARD, code=0x8badf00d
//	"Namespace SIGNAL, Code 6, Subcode …"             → ns=SIGNAL, code=0x6
//	"FRONTBOARD 2343432205"                           → ns=FRONTBOARD, code=0x8badf00d
//
// When a prose reason is present it lands in Termination.Reason so
// categorize rules that look for jetsam sentinels
// ("per-process-limit", "vm-pageshortage") still find them.
func applyAppleCrashTermination(raw *RawCrash, h map[string]string) {
	v, ok := h["Termination Reason"]
	if !ok || v == "" {
		return
	}

	// Form: "Namespace <NS>, Code <C>[, Subcode <S>]"
	if strings.HasPrefix(v, "Namespace ") {
		rest := strings.TrimPrefix(v, "Namespace ")
		parts := strings.SplitN(rest, ",", 3)
		raw.Termination.Namespace = strings.TrimSpace(parts[0])
		for _, part := range parts[1:] {
			p := strings.TrimSpace(part)
			if strings.HasPrefix(p, "Code ") {
				raw.Termination.Code = normalizeAppleCrashCode(strings.TrimSpace(strings.TrimPrefix(p, "Code ")))
			}
			// Subcode is intentionally ignored — no categorize rule
			// keys off it today, and we don't want to overload the
			// Code field with combined values.
		}
		return
	}

	// Form: "<NS> <CODE>[ <reason…>]"
	fields := strings.Fields(v)
	if len(fields) == 0 {
		return
	}
	raw.Termination.Namespace = fields[0]
	if len(fields) >= 2 {
		raw.Termination.Code = normalizeAppleCrashCode(fields[1])
	}
	// Everything after the code (if anything) is the human reason.
	if len(fields) >= 3 {
		reason := strings.Join(fields[2:], " ")
		raw.Termination.Reason = &reason
	}

	// Apple sometimes emits an explicit "Termination Description:" line
	// that carries the jetsam sentinel text ("per-process-limit" etc.).
	// Append it to Reason when present so R-jetsam-01 can find it.
	if d, ok := h["Termination Description"]; ok && d != "" {
		if raw.Termination.Reason == nil {
			reason := d
			raw.Termination.Reason = &reason
		} else {
			combined := *raw.Termination.Reason + "\n" + d
			raw.Termination.Reason = &combined
		}
	}
}

// normalizeAppleCrashCode returns the termination code in "0x<lowerhex>"
// form so categorize rules (which EqualFold against "0x8BADF00D" etc.)
// match consistently whether the .crash emitted the code as hex or as
// a decimal integer.
func normalizeAppleCrashCode(raw string) string {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimSuffix(raw, ",")
	if strings.HasPrefix(raw, "0x") || strings.HasPrefix(raw, "0X") {
		return "0x" + strings.ToLower(raw[2:])
	}
	if v, err := strconv.ParseUint(raw, 10, 64); err == nil {
		return "0x" + strconv.FormatUint(v, 16)
	}
	return raw
}

// --- Binary Images ------------------------------------------------------

// parseAppleCrashImageLine produces a UsedImage from a Binary Images
// entry. Returns false when the line doesn't match the expected shape
// (blank line, stray comment, etc.) — callers just skip those.
func parseAppleCrashImageLine(line string) (UsedImage, bool) {
	m := appleCrashImageLineRE.FindStringSubmatch(line)
	if m == nil {
		return UsedImage{}, false
	}
	base, _ := strconv.ParseUint(m[1], 0, 64)
	end, _ := strconv.ParseUint(m[2], 0, 64)
	size := uint64(0)
	if end >= base {
		size = end - base + 1 // "0xBASE - 0xEND" is inclusive
	}
	uuid := NormalizeUUID(m[5])
	if uuid == "" {
		return UsedImage{}, false
	}
	return UsedImage{
		UUID:        uuid,
		Name:        m[3],
		Path:        m[6],
		Arch:        m[4],
		LoadAddress: base,
		Size:        size,
	}, true
}

// --- Threads ------------------------------------------------------------

// parseAppleCrashThread consumes a thread chunk and returns the parsed
// Thread plus whether its header flagged it as Crashed. The header line
// is the first element of chunk. Frame lines follow; any lines that
// don't match appleCrashFrameRE are ignored (these are typically
// whitespace-aligned symbol annotations or Apple-added notes).
func parseAppleCrashThread(chunk []string, images []UsedImage) (Thread, bool) {
	var th Thread
	if len(chunk) == 0 {
		return th, false
	}
	header := strings.TrimSpace(chunk[0])
	m := appleCrashThreadHeaderRE.FindStringSubmatch(header)
	if m == nil {
		return th, false
	}
	idx, _ := strconv.Atoi(m[1])
	th.Index = idx
	crashed := m[2] != ""
	th.Triggered = crashed

	// Frame parsing — iterate the remaining lines. Frame format:
	//   "  0   libsystem_kernel.dylib        \t0xADDR symbol + offset (file:line)"
	// We use a regex anchored to the frame index + image + address so
	// junk lines (e.g. blank padding, "Thread N name:" lines that
	// sneak through) get dropped rather than mis-parsed.
	fi := 0
	for _, raw := range chunk[1:] {
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" {
			continue
		}
		frame, ok := parseAppleCrashFrame(trimmed, images)
		if !ok {
			continue
		}
		frame.Index = fi
		fi++
		th.Frames = append(th.Frames, frame)
	}
	return th, crashed
}

// appleCrashFrameRE matches a frame line:
//
//	"0   libsystem_kernel.dylib        \t0x000000023dddf1d0 __pthread_kill + 8 (:-1)"
//
// Groups:
//  1. frame index (ignored — we renumber by slice position so thread-N
//     omissions don't leave gaps in the emitted JSON)
//  2. image name (\S+)
//  3. address (0x…)
//  4. remainder — symbol + " + offset" + " (file:line)"
var appleCrashFrameRE = regexp.MustCompile(
	`^(\d+)\s+(\S+)\s+(0x[0-9a-fA-F]+)\s+(.+)$`,
)

// appleCrashFrameTailRE matches the trailing "(file:line)" annotation.
// "file" captures up to the final colon; "line" accepts negative
// numbers because Apple emits "(:-1)" for frames without debug info.
var appleCrashFrameTailRE = regexp.MustCompile(`\s*\(([^()]*):(-?\d+)\)\s*$`)

// appleCrashOffsetRE matches the " + <offset>" suffix of the symbol
// portion. Used to split "symbol + offset" when no (file:line) tail is
// present.
var appleCrashOffsetRE = regexp.MustCompile(`\s*\+\s*(\d+)\s*$`)

// parseAppleCrashFrame constructs a Frame from a trimmed frame line.
// Resolves the image name into its UUID using the UsedImages array so
// Frame.UUID is populated for the symbolicate pipeline (which groups
// frames by UUID).
func parseAppleCrashFrame(trimmed string, images []UsedImage) (Frame, bool) {
	m := appleCrashFrameRE.FindStringSubmatch(trimmed)
	if m == nil {
		return Frame{}, false
	}
	imageName := m[2]
	addr := m[3]
	rest := strings.TrimSpace(m[4])

	f := Frame{
		Address: addr,
		Image:   imageName,
	}

	// Pull off the trailing "(file:line)" if present.
	if tm := appleCrashFrameTailRE.FindStringSubmatchIndex(rest); tm != nil {
		// tm is a pair-list; tm[2:4] is group 1 (file), tm[4:6] is group 2 (line).
		file := rest[tm[2]:tm[3]]
		lineStr := rest[tm[4]:tm[5]]
		rest = strings.TrimSpace(rest[:tm[0]])
		f.File = file
		if n, err := strconv.Atoi(lineStr); err == nil && n > 0 {
			// "(:-1)" means "no source info"; only record positive lines.
			f.Line = n
		}
	}

	// Pull off " + <offset>" from the symbol tail.
	if om := appleCrashOffsetRE.FindStringSubmatchIndex(rest); om != nil {
		off := rest[om[2]:om[3]]
		rest = strings.TrimSpace(rest[:om[0]])
		if n, err := strconv.Atoi(off); err == nil {
			f.ImageOffset = n
		}
	}

	// What remains is the symbol. Can be empty (Apple sometimes emits
	// only "+ offset" for stripped frames) or "<deduplicated_symbol>".
	f.Symbol = rest
	f.Symbolicated = rest != "" && rest != "<deduplicated_symbol>"

	// Resolve Image → UUID so the symbolicate pipeline can group frames
	// by UUID. Match by name; if two images share a name, prefer the
	// one whose load-address range contains the frame address (which
	// is always the correct one for the frame).
	f.UUID = lookupImageUUIDForFrame(images, imageName, addr)
	return f, true
}

// lookupImageUUIDForFrame resolves a frame's Image+Address to the UUID
// of the containing used image. When multiple images share Name
// (rare — e.g. different versions of the same dylib loaded in separate
// cryptexes), address-range containment disambiguates. Returns "" when
// no image matches; the symbolicate pipeline treats empty-UUID frames
// as non-symbolicatable and skips them rather than mis-attributing.
func lookupImageUUIDForFrame(images []UsedImage, name, addr string) string {
	if len(images) == 0 {
		return ""
	}
	parsed, err := strconv.ParseUint(addr, 0, 64)
	hasAddr := err == nil
	// Prefer an image whose address range contains the frame.
	for _, img := range images {
		if img.Name != name {
			continue
		}
		if hasAddr && img.Size > 0 && parsed >= img.LoadAddress && parsed < img.LoadAddress+img.Size {
			return img.UUID
		}
	}
	// Fall back to first-by-name match.
	for _, img := range images {
		if img.Name == name {
			return img.UUID
		}
	}
	return ""
}

// --- Thread state -------------------------------------------------------

// appleCrashRegPairRE extracts "<name>: <hex>" register pairs from the
// thread-state block. One line usually carries several pairs separated
// by whitespace.
var appleCrashRegPairRE = regexp.MustCompile(`\b([a-zA-Z][a-zA-Z0-9_]*)\s*:\s*(0x[0-9a-fA-F]+)`)

// parseAppleCrashThreadState extracts the sp/pc values from the register
// dump. Returns nil when neither register was found — the only consumer
// (R-stack-overflow-01) uses a zero SP as "no signal" anyway, so a nil
// ThreadState and a zero-filled one are equivalent for categorize, but
// nil keeps the JSON compact.
func parseAppleCrashThreadState(lines []string) *ThreadState {
	state := &ThreadState{}
	foundAny := false
	for _, line := range lines {
		for _, m := range appleCrashRegPairRE.FindAllStringSubmatch(line, -1) {
			reg := strings.ToLower(m[1])
			val, err := strconv.ParseUint(m[2], 0, 64)
			if err != nil {
				continue
			}
			switch reg {
			case "sp":
				state.SP = val
				foundAny = true
			case "pc":
				state.PC = val
				foundAny = true
			}
		}
	}
	if !foundAny {
		return nil
	}
	return state
}
