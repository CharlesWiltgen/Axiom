package main

import (
	"bufio"
	"bytes"
	"encoding/json"
)

const (
	FormatIPSv1     = "ips_json_v1"
	FormatIPSv2     = "ips_json_v2"
	FormatMetricKit = "metrickit_json"
	FormatUnknown   = "unknown"
)

// DetectFormat inspects the first few KB of a crash file to determine format.
// v2: first line is small JSON header, second line is large JSON payload.
// v1: single JSON blob containing "bug_type" and "usedImages" at top level.
// metrickit: top-level keys include "callStackTree" and "exceptionType" (not a string).
func DetectFormat(data []byte) string {
	if !isLikelyJSON(data) {
		return FormatUnknown
	}

	// Try v2: header line + payload line
	sc := bufio.NewScanner(bytes.NewReader(data))
	sc.Buffer(make([]byte, 0, 1<<20), 8<<20)
	if sc.Scan() {
		first := sc.Bytes()
		if isIPSv2Header(first) && sc.Scan() {
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
