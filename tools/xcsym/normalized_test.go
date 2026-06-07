package main

import "testing"

func TestDecodeNormalizedReport_FullHang(t *testing.T) {
	line := []byte(`{"provider":"sentry","issue_id":"POPPY-3V","kind":"hang",
	  "impact":{"users":68,"events":412},
	  "versions":{"affected":["2.1.0","2.1.1"],"min":"2.1.0","max":"2.1.1"},
	  "os":{"platform":"iOS","versions":["18.4","26.0"]},
	  "crashed_thread":0,
	  "threads":[{"index":0,"crashed":true,"frames":[
	    {"image":"libsystem_kernel.dylib","symbol":"mach_msg2_trap","in_app":false}]}]}`)
	r, err := decodeNormalizedReport(line)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if r.IssueID != "POPPY-3V" || r.Kind != "hang" || r.Impact.Users != 68 {
		t.Fatalf("bad decode: %+v", r)
	}
	if len(r.Threads) != 1 || !r.Threads[0].Crashed || r.Threads[0].Frames[0].Symbol != "mach_msg2_trap" {
		t.Fatalf("bad threads: %+v", r.Threads)
	}
}

func TestDecodeNormalizedReport_MinimalFramesUnavailable(t *testing.T) {
	line := []byte(`{"provider":"asc","issue_id":"X","kind":"crash",
	  "impact":{"users":12,"events":30},"frames_unavailable":true,
	  "exception":{"mach_exception":"0x8badf00d"},"threads":[]}`)
	r, err := decodeNormalizedReport(line)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !r.FramesUnavailable || r.Exception.MachException != "0x8badf00d" {
		t.Fatalf("bad minimal decode: %+v", r)
	}
}
