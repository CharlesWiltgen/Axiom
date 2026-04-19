package main

import (
	"bytes"
	"encoding/json"
)

const (
	FormatIPSv1     = "ips_json_v1"
	FormatIPSv2     = "ips_json_v2"
	FormatMetricKit = "metrickit_json"
	FormatUnknown   = "unknown"
)

// DetectFormat inspects crash data to determine its format.
// v2: first line is small JSON header (app_name, timestamp), second line is large JSON payload.
// v1: single JSON blob containing "bug_type" and "usedImages" at top level.
// metrickit: top-level keys include "callStackTree" and "exceptionType".
func DetectFormat(data []byte) string {
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
	if _, ok := top["callStackTree"]; ok {
		if _, hasType := top["exceptionType"]; hasType {
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
