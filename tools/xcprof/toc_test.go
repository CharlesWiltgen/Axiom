package main

import "testing"

func TestParseTOCMetadata(t *testing.T) {
	toc, err := parseTOC(loadFixture(t, "toc.xml"))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if toc.Target.Name != "yes" || toc.Target.PID != 37476 {
		t.Errorf("target = %s/%d, want yes/37476", toc.Target.Name, toc.Target.PID)
	}
	if toc.Device.Platform != "macOS" || toc.Device.OSVersion != "26.5 (25F71)" {
		t.Errorf("device = %s %s", toc.Device.Platform, toc.Device.OSVersion)
	}
	if toc.RecordingMode != "Deferred" {
		t.Errorf("recording mode = %q, want Deferred", toc.RecordingMode)
	}
	if toc.DurationSec < 3.4 || toc.DurationSec > 3.5 {
		t.Errorf("duration = %v, want ~3.45", toc.DurationSec)
	}
}

func TestParseTOCSchemas(t *testing.T) {
	toc, _ := parseTOC(loadFixture(t, "toc.xml"))
	if !toc.hasSchema("cpu-profile") {
		t.Error("expected cpu-profile schema present")
	}
	if toc.hasSchema("leaks") || toc.hasSchema("power") {
		t.Error("cpu trace should not report memory/energy schemas")
	}
}

func TestSupportMatrix(t *testing.T) {
	toc, _ := parseTOC(loadFixture(t, "toc.xml"))
	want := map[string]string{
		"cpu":     statusAvailable,
		"memory":  statusNotPresent,
		"network": statusNotPresent,
		"energy":  statusNotPresent,
		"hangs":   statusNotPresent,
	}
	for _, f := range supportMatrix(toc, 21) {
		if want[f.Family] != f.Status {
			t.Errorf("family %s = %q, want %q", f.Family, f.Status, want[f.Family])
		}
	}
}

func TestSupportMatrixCPUPartialWhenNoSamples(t *testing.T) {
	toc, _ := parseTOC(loadFixture(t, "toc.xml"))
	for _, f := range supportMatrix(toc, 0) {
		if f.Family == "cpu" && f.Status != statusPartial {
			t.Errorf("cpu with 0 samples = %q, want partial", f.Status)
		}
	}
}
