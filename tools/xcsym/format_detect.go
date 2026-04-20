package main

import (
	"bytes"
	"encoding/json"
)

const (
	FormatIPSv1       = "ips_json_v1"
	FormatIPSv2       = "ips_json_v2"
	FormatMetricKit   = "metrickit_json"
	FormatAppleCrash  = "apple_crash_text"
	FormatUnknown     = "unknown"
)

// DetectFormat inspects crash data to determine its format.
// v2: first line is small JSON header (app_name, timestamp), second line is large JSON payload.
// v1: single JSON blob containing "bug_type" and "usedImages" at top level.
// metrickit: top-level keys include "callStackTree" and "exceptionType".
// apple_crash_text: Apple's legacy .crash text format emitted by Xcode
// Organizer when users "Show in Finder" on a TestFlight crash. Identified
// by the "Incident Identifier:" header marker (or, rarely, by the older
// bare "Process:" header when the newer prefix was stripped during
// transport).
func DetectFormat(data []byte) string {
	if isAppleCrashText(data) {
		return FormatAppleCrash
	}
	if !isLikelyJSON(data) {
		return FormatUnknown
	}

	// Try v2 first: split on first newline, check if the header half parses as an IPS v2 header.
	// bytes.IndexByte has no size cap, so payloads of any size work.
	if idx := bytes.IndexByte(data, '\n'); idx > 0 {
		first := bytes.TrimSpace(data[:idx])
		rest := bytes.TrimSpace(data[idx+1:])
		if len(rest) > 0 && isIPSv2Header(first) {
			return FormatIPSv2
		}
	}

	// Single-blob cases (v1 or metrickit)
	var top map[string]json.RawMessage
	if err := json.Unmarshal(data, &top); err != nil {
		return FormatUnknown
	}
	// MetricKit ships in two shapes: the real MXCrashDiagnostic JSON nests
	// exception metadata under diagnosticMetaData; flattened/legacy variants
	// surface exceptionType at the top level. Accept both rather than force
	// callers to preprocess.
	if _, ok := top["callStackTree"]; ok {
		if _, hasType := top["exceptionType"]; hasType {
			return FormatMetricKit
		}
		if _, hasMeta := top["diagnosticMetaData"]; hasMeta {
			return FormatMetricKit
		}
	}
	_, hasBug := top["bug_type"]
	_, hasUsed := top["usedImages"]
	if hasBug && hasUsed {
		return FormatIPSv1
	}
	return FormatUnknown
}

func isLikelyJSON(data []byte) bool {
	for _, b := range data {
		if b == ' ' || b == '\t' || b == '\r' || b == '\n' {
			continue
		}
		return b == '{' || b == '['
	}
	return false
}

func isIPSv2Header(line []byte) bool {
	var h map[string]json.RawMessage
	if err := json.Unmarshal(line, &h); err != nil {
		return false
	}
	_, hasName := h["app_name"]
	_, hasTimestamp := h["timestamp"]
	return hasName && hasTimestamp
}

// isAppleCrashText checks the first non-whitespace line for the legacy
// .crash header marker. "Incident Identifier:" is the canonical first
// line Apple emits (since iOS 6+); we also accept "Process:" as a
// fallback for pre-iOS-6 reports and for .crash snippets that lost their
// header during transport. The check is deliberately conservative — any
// line that would plausibly start a JSON blob ('{' or '[') forces
// FormatUnknown so we never mis-detect a stray IPS file.
func isAppleCrashText(data []byte) bool {
	// Skip leading whitespace then grab the first line.
	i := 0
	for i < len(data) && (data[i] == ' ' || data[i] == '\t' || data[i] == '\r' || data[i] == '\n') {
		i++
	}
	if i >= len(data) {
		return false
	}
	// Bail immediately on anything that could be a JSON blob — belt and
	// braces against a .ips whose header happens to contain the word
	// "Incident" somewhere after an opening brace.
	if data[i] == '{' || data[i] == '[' {
		return false
	}
	end := bytes.IndexByte(data[i:], '\n')
	var first []byte
	if end < 0 {
		first = data[i:]
	} else {
		first = data[i : i+end]
	}
	first = bytes.TrimRight(first, " \t\r")
	return bytes.HasPrefix(first, []byte("Incident Identifier:")) ||
		bytes.HasPrefix(first, []byte("Process:"))
}
