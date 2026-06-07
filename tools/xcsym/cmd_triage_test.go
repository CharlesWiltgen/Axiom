package main

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func runTriageString(t *testing.T, stdin string, args ...string) (TriageResult, int) {
	t.Helper()
	var out bytes.Buffer
	code := runTriageWithStdin(&out, args, strings.NewReader(stdin))
	var res TriageResult
	if err := json.Unmarshal(out.Bytes(), &res); err != nil {
		t.Fatalf("output not valid JSON: %v\n%s", err, out.String())
	}
	return res, code
}

func TestRunTriage_ClassifiesCrashAndSkipsMalformed(t *testing.T) {
	jsonl := strings.Join([]string{
		`{"provider":"sentry","issue_id":"A","kind":"crash","impact":{"users":5,"events":9},"exception":{"type":"EXC_BAD_ACCESS","subtype":"KERN_INVALID_ADDRESS"},"crashed_thread":0,"threads":[{"index":0,"crashed":true,"frames":[{"image":"MyApp","symbol":"boom","in_app":true}]}]}`,
		`{ this is not json `,
		`{"provider":"sentry","issue_id":"B","kind":"crash","impact":{"users":1,"events":1},"exception":{"type":"EXC_CRASH","signal":"SIGABRT"},"crashed_thread":0,"threads":[{"index":0,"crashed":true,"frames":[{"image":"libsystem_c.dylib","symbol":"abort"}]}]}`,
	}, "\n")
	res, code := runTriageString(t, jsonl)
	if code != 0 {
		t.Fatalf("exit = %d, want 0 (malformed lines are skipped, not fatal)", code)
	}
	if res.Summary.Total != 2 || res.Summary.Skipped != 1 {
		t.Fatalf("summary = %+v, want total 2 skipped 1", res.Summary)
	}
	if len(res.Errors) != 1 {
		t.Fatalf("errors = %+v, want 1", res.Errors)
	}
	var a *TriageIssue
	for i := range res.Issues {
		if res.Issues[i].IssueID == "A" {
			a = &res.Issues[i]
		}
	}
	if a == nil || a.PatternTag != "bad_memory_access" {
		t.Fatalf("issue A pattern = %+v, want bad_memory_access", a)
	}
}

func TestRunTriage_EmptyArraysNotNull(t *testing.T) {
	var out bytes.Buffer
	jsonl := `{"provider":"sentry","issue_id":"A","kind":"crash","impact":{"users":1,"events":1},"exception":{"type":"EXC_BAD_ACCESS","subtype":"KERN_INVALID_ADDRESS"},"crashed_thread":0,"threads":[{"index":0,"crashed":true,"frames":[{"image":"MyApp","symbol":"boom","in_app":true}]}]}`
	runTriageWithStdin(&out, nil, strings.NewReader(jsonl))
	s := out.String()
	if strings.Contains(s, `"noise_flags":null`) {
		t.Errorf("noise_flags marshaled as null:\n%s", s)
	}
	if strings.Contains(s, `"clusters":null`) {
		t.Errorf("clusters marshaled as null:\n%s", s)
	}
}
