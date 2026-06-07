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

func TestRunTriage_EndToEnd_SuspensionDemotedRealBugSurfaced(t *testing.T) {
	jsonl := strings.Join([]string{
		// idle-runloop hang, huge user count → must be flagged noise, NOT top priority
		`{"provider":"sentry","issue_id":"POPPY-3V","kind":"hang","impact":{"users":68,"events":412},"crashed_thread":0,"threads":[{"index":0,"crashed":true,"frames":[{"image":"libsystem_kernel.dylib","symbol":"mach_msg2_trap"},{"image":"CoreFoundation","symbol":"CFRunLoopRun"}]}]}`,
		// real nil-unwrap crash, small user count → must remain a candidate family
		`{"provider":"sentry","issue_id":"REAL-1","kind":"crash","impact":{"users":4,"events":6},"exception":{"type":"EXC_BREAKPOINT","subtype":"Swift runtime failure: unexpectedly found nil while unwrapping an Optional value"},"crashed_thread":0,"threads":[{"index":0,"crashed":true,"frames":[{"image":"MyApp","symbol":"ContentView.body.getter","in_app":true}]}]}`,
	}, "\n")
	res, code := runTriageString(t, jsonl)
	if code != 0 {
		t.Fatalf("exit = %d", code)
	}
	var poppy, real *TriageIssue
	for i := range res.Issues {
		switch res.Issues[i].IssueID {
		case "POPPY-3V":
			poppy = &res.Issues[i]
		case "REAL-1":
			real = &res.Issues[i]
		}
	}
	if poppy == nil || len(poppy.NoiseFlags) == 0 || poppy.NoiseFlags[0].Class != "anr_suspension_false_positive" {
		t.Fatalf("POPPY-3V should be noise-flagged: %+v", poppy)
	}
	if real == nil || len(real.NoiseFlags) != 0 || real.PatternTag != "swift_forced_unwrap" {
		t.Fatalf("REAL-1 should be a clean candidate family: %+v", real)
	}
	if res.Summary.FlaggedNoise != 1 || res.Summary.CandidateFamilies != 1 {
		t.Fatalf("summary = %+v, want flagged_noise 1 candidate_families 1", res.Summary)
	}
}

func TestRunTriage_FramesUnavailableDowngradesConfidence(t *testing.T) {
	jsonl := `{"provider":"asc","issue_id":"U","kind":"crash","impact":{"users":2,"events":3},"frames_unavailable":true,"exception":{"mach_exception":"0xdead10cc"},"threads":[]}`
	res, code := runTriageString(t, jsonl)
	if code != 0 {
		t.Fatalf("exit = %d", code)
	}
	if len(res.Issues) != 1 {
		t.Fatalf("issues = %d, want 1", len(res.Issues))
	}
	is := res.Issues[0]
	if is.PatternTag != "data_protection_violation" {
		t.Fatalf("pattern_tag = %q, want data_protection_violation", is.PatternTag)
	}
	if is.PatternConfidence != "low" {
		t.Fatalf("pattern_confidence = %q, want low (frames_unavailable caps it)", is.PatternConfidence)
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
