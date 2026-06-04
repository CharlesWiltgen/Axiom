package main

import "testing"

func TestAggregateHotFramesAttribution(t *testing.T) {
	samples, _ := parseCPUProfile(loadFixture(t, "cpu-profile.xml"))
	hot := aggregateHotFrames(samples, 0)
	byName := map[string]HotFrame{}
	for _, hf := range hot {
		byName[hf.Name] = hf
	}
	// The yes frame appears in every stack (inclusive over all 21 samples).
	yes := byName["0x1024044f0"]
	if yes.Samples != wantSamples {
		t.Errorf("yes frame appears in %d samples, want %d", yes.Samples, wantSamples)
	}
	// write is the leaf in all but the 2-frame sample (self == inclusive there).
	write := byName["write"]
	if write.Self != write.Inclusive {
		t.Errorf("write self=%d inclusive=%d, want equal (always leaf)", write.Self, write.Inclusive)
	}
	if write.Samples != wantSamples-1 {
		t.Errorf("write appears in %d samples, want %d", write.Samples, wantSamples-1)
	}
}

func TestTopUserFramesOnlyAppCode(t *testing.T) {
	samples, _ := parseCPUProfile(loadFixture(t, "cpu-profile.xml"))
	user := topUserFrames(samples, userBinarySet("yes", nil), 0)
	if len(user) != 1 {
		t.Fatalf("got %d user frames, want 1 (only the yes binary)", len(user))
	}
	if user[0].Name != "0x1024044f0" || user[0].Binary != "yes" {
		t.Errorf("user frame = %+v, want the yes frame", user[0])
	}
}

func TestMainThreadStats(t *testing.T) {
	samples, _ := parseCPUProfile(loadFixture(t, "cpu-profile.xml"))
	mt := mainThreadStats(samples, 250)
	if mt.Samples != wantSamples {
		t.Errorf("main-thread samples = %d, want %d", mt.Samples, wantSamples)
	}
	if mt.MaxGapMS != 361 {
		t.Errorf("max gap = %dms, want 361", mt.MaxGapMS)
	}
	if mt.CandidateStalls != 4 {
		t.Errorf("candidate stalls = %d, want 4 (gaps >= 250ms)", mt.CandidateStalls)
	}
}

func TestScopeByTime(t *testing.T) {
	samples, _ := parseCPUProfile(loadFixture(t, "cpu-profile.xml"))
	scoped := scopeByTime(samples, 600, 700)
	if len(scoped) != 2 {
		t.Errorf("samples in 600-700ms = %d, want 2 (621ms, 679ms)", len(scoped))
	}
}

func TestBuildReportEndToEnd(t *testing.T) {
	rep, err := buildReport("cpu.trace", loadFixture(t, "toc.xml"), loadFixture(t, "cpu-profile.xml"), 0, 0, nil, 250)
	if err != nil {
		t.Fatalf("buildReport: %v", err)
	}
	if rep.CPUSamples != wantSamples {
		t.Errorf("cpu samples = %d, want %d", rep.CPUSamples, wantSamples)
	}
	if rep.Summary.Target != "yes" {
		t.Errorf("summary target = %q", rep.Summary.Target)
	}
	if len(rep.UserFrames) != 1 {
		t.Errorf("user frames = %d, want 1", len(rep.UserFrames))
	}
	if rep.MainThread == nil || rep.MainThread.Samples != wantSamples {
		t.Errorf("main-thread stats missing or wrong sample count")
	}
	var cpuStatus string
	for _, f := range rep.Support {
		if f.Family == "cpu" {
			cpuStatus = f.Status
		}
	}
	if cpuStatus != statusAvailable {
		t.Errorf("cpu support = %q, want available", cpuStatus)
	}
}

func TestBuildReportScopedWindow(t *testing.T) {
	rep, _ := buildReport("cpu.trace", loadFixture(t, "toc.xml"), loadFixture(t, "cpu-profile.xml"), 600, 700, nil, 250)
	if rep.Scope == nil || rep.Scope.SamplesInScope != 2 {
		t.Errorf("scoped report should report 2 samples in 600-700ms window, got %+v", rep.Scope)
	}
	if rep.CPUSamples != 2 {
		t.Errorf("scoped cpu samples = %d, want 2", rep.CPUSamples)
	}
}

func TestBuildReportScopeDoesNotDowngradeSupport(t *testing.T) {
	// A window past the trace end excludes every sample, but the trace DID
	// contain cpu data — the support matrix is trace-level, so cpu must stay
	// "available", not flip to "partial — no samples parsed".
	rep, _ := buildReport("cpu.trace", loadFixture(t, "toc.xml"), loadFixture(t, "cpu-profile.xml"), 999000, 1000000, nil, 250)
	if rep.CPUSamples != 0 {
		t.Fatalf("expected 0 samples in an out-of-range window, got %d", rep.CPUSamples)
	}
	var cpu string
	for _, f := range rep.Support {
		if f.Family == "cpu" {
			cpu = f.Status
		}
	}
	if cpu != statusAvailable {
		t.Errorf("cpu support = %q for an empty scope window, want available (full trace had samples)", cpu)
	}
}

func TestRenderMarkdownSectionOrder(t *testing.T) {
	rep, _ := buildReport("cpu.trace", loadFixture(t, "toc.xml"), loadFixture(t, "cpu-profile.xml"), 0, 0, nil, 250)
	md := renderMarkdown(rep)
	sections := []string{"## Summary", "## Support", "## CPU", "## Main thread", "## Top user-code frames"}
	last := -1
	for _, sec := range sections {
		idx := indexOf(md, sec)
		if idx < 0 {
			t.Fatalf("section %q missing from report", sec)
		}
		if idx < last {
			t.Errorf("section %q out of order", sec)
		}
		last = idx
	}
}

func indexOf(haystack, needle string) int {
	for i := 0; i+len(needle) <= len(haystack); i++ {
		if haystack[i:i+len(needle)] == needle {
			return i
		}
	}
	return -1
}
