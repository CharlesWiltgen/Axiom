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
	// memory and energy are categorically not_exportable (their data never
	// reaches an xctrace-exportable table); network is genuinely absent from a
	// pure cpu trace, so not_present.
	want := map[string]string{
		"cpu":     statusAvailable,
		"memory":  statusNotExportable,
		"network": statusNotPresent,
		"energy":  statusNotExportable,
		"hangs":   statusNotPresent,
	}
	for _, f := range supportMatrix(toc, 21, 0) {
		if want[f.Family] != f.Status {
			t.Errorf("family %s = %q, want %q", f.Family, f.Status, want[f.Family])
		}
		// A not_exportable family must carry an explanatory note, never a silent status.
		if f.Status == statusNotExportable && f.Note == "" {
			t.Errorf("family %s is not_exportable but has no note", f.Family)
		}
	}
}

func TestSupportMatrixCPUPartialWhenNoSamples(t *testing.T) {
	toc, _ := parseTOC(loadFixture(t, "toc.xml"))
	for _, f := range supportMatrix(toc, 0, 0) {
		if f.Family == "cpu" && f.Status != statusPartial {
			t.Errorf("cpu with 0 samples = %q, want partial", f.Status)
		}
	}
}

func TestSupportMatrixNetwork(t *testing.T) {
	// A trace whose TOC carries the network-connection-stat table: available once
	// connections parse, partial when the table is present but empty.
	toc := &TOC{Schemas: []string{"network-connection-stat"}}
	status := func(conns int) string {
		for _, f := range supportMatrix(toc, 0, conns) {
			if f.Family == "network" {
				return f.Status
			}
		}
		return ""
	}
	if got := status(13); got != statusAvailable {
		t.Errorf("network with 13 connections = %q, want available", got)
	}
	if got := status(0); got != statusPartial {
		t.Errorf("network with table present but 0 connections = %q, want partial", got)
	}
}
