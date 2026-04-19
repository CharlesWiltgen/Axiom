package main

import "testing"

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
