package main

import (
	"bytes"
	"testing"
)

func TestDetectFormat(t *testing.T) {
	cases := []struct {
		name string
		in   []byte
		want string
	}{
		{"ips v2", []byte(`{"app_name":"MyApp","timestamp":"..."}` + "\n" + `{"exception":{"type":"EXC_BAD_ACCESS"}}`), "ips_json_v2"},
		{"ips v1 single blob", []byte(`{"bug_type":"309","exception":{"type":"EXC_BREAKPOINT"},"usedImages":[]}`), "ips_json_v1"},
		{"metrickit", []byte(`{"callStackTree":{"callStacks":[]},"exceptionType":1,"exceptionCode":0}`), "metrickit_json"},
		{"unknown", []byte(`{"something":"else"}`), "unknown"},
		{"non-json", []byte(`Exception Type: EXC_BAD_ACCESS`), "unknown"},
		{"apple_crash canonical", []byte("Incident Identifier: 00000000-0000-0000-0000-000000000000\nProcess: App [1]\n"), "apple_crash_text"},
		{"apple_crash process-only", []byte("Process:             App [1]\nIdentifier:          com.example.redacted\n"), "apple_crash_text"},
		{"apple_crash leading blank lines", []byte("\n\n  Incident Identifier: 11111111-2222-3333-4444-555555555555\n"), "apple_crash_text"},
		{"apple_crash not-really first line similar word", []byte("Incident-of-something else\n"), "unknown"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := DetectFormat(c.in)
			if got != c.want {
				t.Errorf("DetectFormat got %q, want %q", got, c.want)
			}
		})
	}
}

// Real .ips v2 payloads on image-heavy apps can exceed the 8MB bufio.Scanner
// default. A valid v2 file must classify regardless of payload size.
func TestDetectFormatLargeV2Payload(t *testing.T) {
	header := []byte(`{"app_name":"BigApp","timestamp":"2026-04-19"}` + "\n")
	// 10MB payload — enough to defeat any reasonable scanner buffer cap.
	payload := []byte(`{"exception":{"type":"EXC_BAD_ACCESS"},"filler":"`)
	payload = append(payload, bytes.Repeat([]byte("x"), 10*1024*1024)...)
	payload = append(payload, []byte(`"}`)...)
	data := append(header, payload...)
	if got := DetectFormat(data); got != FormatIPSv2 {
		t.Errorf("large v2 payload misclassified: got %q, want %q", got, FormatIPSv2)
	}
}
