package main

import (
	"strconv"
	"strings"
)

// normalizeTerminationCode renders a termination/mach code as "0x<lowerhex>"
// so EqualFold checks in the rule engine match regardless of provider
// encoding. Hex strings are lowercased; decimal strings are converted; an
// unrecognized string is returned lowercased unchanged.
func normalizeTerminationCode(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if strings.HasPrefix(strings.ToLower(s), "0x") {
		return strings.ToLower(s)
	}
	if i, err := strconv.ParseInt(s, 10, 64); err == nil {
		if i < 0 {
			return "0x" + strconv.FormatUint(uint64(i), 16)
		}
		return "0x" + strconv.FormatInt(i, 16)
	}
	if u, err := strconv.ParseUint(s, 10, 64); err == nil {
		return "0x" + strconv.FormatUint(u, 16)
	}
	return strings.ToLower(s)
}

// buildRawCrashFromNormalizedReport converts a provider-normalized report into
// the internal RawCrash the rule engine consumes, WITHOUT parsing a .ips and
// WITHOUT symbolication. It is responsible for: CrashedIdx (slice position of
// crashed_thread, falling back to the Crashed-flagged thread), mach_exception
// hex normalization into Termination.Code, and threading InApp.
func buildRawCrashFromNormalizedReport(r *NormalizedReport) *RawCrash {
	raw := &RawCrash{
		Format: FormatNormalized,
		Kind:   r.Kind,
		OS:     OSInfo{Platform: r.OS.Platform},
		Exception: Exception{
			Type:    r.Exception.Type,
			Codes:   r.Exception.Codes,
			Subtype: r.Exception.Subtype,
			Signal:  r.Exception.Signal,
		},
		Termination: Termination{Namespace: r.Termination.Namespace},
	}
	if r.OS.Versions != nil && len(r.OS.Versions) > 0 {
		raw.OS.Version = r.OS.Versions[0]
	}
	// Prefer an explicit termination code; else fall back to the mach exception.
	code := r.Termination.Code
	if code == "" {
		code = r.Exception.MachException
	}
	raw.Termination.Code = normalizeTerminationCode(code)

	// Build threads, tracking two crashed-thread candidates.
	idxCrashedFlag := -1 // first thread with crashed:true (provider's explicit marker)
	idxIndexMatch := -1  // first thread whose Index == crashed_thread
	for i, t := range r.Threads {
		th := Thread{Index: t.Index, Triggered: t.Crashed}
		for _, f := range t.Frames {
			th.Frames = append(th.Frames, Frame{
				Image:        f.Image,
				Symbol:       f.Symbol,
				ImageOffset:  f.Offset,
				InApp:        f.InApp,
				Symbolicated: f.Symbol != "",
			})
		}
		raw.Threads = append(raw.Threads, th)
		if idxCrashedFlag == -1 && t.Crashed {
			idxCrashedFlag = i
		}
		if idxIndexMatch == -1 && t.Index == r.CrashedThread {
			idxIndexMatch = i
		}
	}
	// Resolve the crashed thread. Prefer the explicit per-thread crashed:true
	// flag (Sentry's authoritative marker) over the crashed_thread index: the
	// index is an int whose zero value can't distinguish "omitted" from "0", so
	// a provider that omits crashed_thread would otherwise pick whatever thread
	// happens to have Index 0 — even a non-crashed one. Index match is the
	// fallback; slice 0 is the last resort.
	switch {
	case idxCrashedFlag >= 0:
		raw.CrashedIdx = idxCrashedFlag
	case idxIndexMatch >= 0:
		raw.CrashedIdx = idxIndexMatch
	default:
		raw.CrashedIdx = 0
	}
	return raw
}
