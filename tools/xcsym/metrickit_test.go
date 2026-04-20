package main

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestParseMetricKit_SwiftForcedUnwrap(t *testing.T) {
	raw, err := ParseMetricKit(readFixture(t, "crashes/metrickit/swift_forced_unwrap.json"))
	if err != nil {
		t.Fatalf("ParseMetricKit: %v", err)
	}
	if raw.Format != FormatMetricKit {
		t.Errorf("format = %q, want %q", raw.Format, FormatMetricKit)
	}
	if raw.App.BundleID != "com.example.MyApp" {
		t.Errorf("bundle = %q", raw.App.BundleID)
	}
	if raw.App.Version != "1.0" {
		t.Errorf("app.version = %q, want 1.0", raw.App.Version)
	}
	if raw.Arch != "arm64" {
		t.Errorf("arch = %q, want arm64", raw.Arch)
	}
	if raw.Exception.Type != "EXC_BREAKPOINT" {
		t.Errorf("exception.type = %q, want EXC_BREAKPOINT (exceptionType=6)", raw.Exception.Type)
	}
	if raw.Exception.Signal != "SIGTRAP" {
		t.Errorf("exception.signal = %q, want SIGTRAP (signal=5)", raw.Exception.Signal)
	}
	// R-swift-unwrap-01 needs subtype to contain the "unexpectedly found nil" phrase.
	if Categorize(raw).RuleID != "R-swift-unwrap-01" {
		t.Errorf("categorize = %q, want R-swift-unwrap-01 (subtype=%q)",
			Categorize(raw).RuleID, raw.Exception.Subtype)
	}
	if len(raw.Threads) != 1 {
		t.Fatalf("threads = %d, want 1", len(raw.Threads))
	}
	if raw.CrashedIdx != 0 {
		t.Errorf("CrashedIdx = %d, want 0 (threadAttributed marks it)", raw.CrashedIdx)
	}
	if !raw.Threads[0].Triggered {
		t.Error("thread 0 should be triggered")
	}
	// Flatten should produce 2 frames. Order: crash-site first (leaf subframe),
	// caller last. This mirrors .ips convention and lets categorize rules
	// that scan "top N frames" fire on either format.
	if len(raw.Threads[0].Frames) != 2 {
		t.Fatalf("frames = %d, want 2", len(raw.Threads[0].Frames))
	}
	// Leaf subFrame had offset 100 → should appear before root offset 500
	// after flatten+reverse (leaf is the crash site, which is "frame 0" in
	// Apple's crash-report convention).
	if raw.Threads[0].Frames[0].ImageOffset != 100 {
		t.Errorf("frame[0] offset = %d, want 100 (leaf-first ordering)",
			raw.Threads[0].Frames[0].ImageOffset)
	}
	if raw.Threads[0].Frames[1].ImageOffset != 500 {
		t.Errorf("frame[1] offset = %d, want 500 (root frame last)",
			raw.Threads[0].Frames[1].ImageOffset)
	}
	// Frames carry binaryName, binaryUUID synthesizes a UsedImage entry.
	if raw.Threads[0].Frames[0].Image != "MyApp" {
		t.Errorf("frame image = %q, want MyApp", raw.Threads[0].Frames[0].Image)
	}
	// UsedImages synthesized from frame metadata (MetricKit doesn't carry a
	// separate used-images array).
	if len(raw.UsedImages) != 1 {
		t.Fatalf("usedImages = %d, want 1 (dedup by UUID)", len(raw.UsedImages))
	}
	if raw.UsedImages[0].UUID != "AABBCCDD-EEFF-0011-2233-445566778899" {
		t.Errorf("usedImages[0].UUID = %q", raw.UsedImages[0].UUID)
	}
	if raw.UsedImages[0].Name != "MyApp" {
		t.Errorf("usedImages[0].Name = %q, want MyApp", raw.UsedImages[0].Name)
	}
	if raw.UsedImages[0].Arch != "arm64" {
		t.Errorf("usedImages[0].Arch = %q, want arm64", raw.UsedImages[0].Arch)
	}
}

func TestParseMetricKit_ExceptionTypeMap(t *testing.T) {
	cases := []struct {
		exType int
		want   string
	}{
		{1, "EXC_BAD_ACCESS"},
		{2, "EXC_BAD_INSTRUCTION"},
		{6, "EXC_BREAKPOINT"},
		{10, "EXC_CRASH"},
		{11, "EXC_RESOURCE"},
		{12, "EXC_GUARD"},
		{99, "EXC_UNKNOWN(99)"}, // out-of-table falls back to a visible marker
	}
	for _, c := range cases {
		t.Run(c.want, func(t *testing.T) {
			if got := exceptionTypeName(c.exType); got != c.want {
				t.Errorf("exceptionTypeName(%d) = %q, want %q", c.exType, got, c.want)
			}
		})
	}
}

func TestParseMetricKit_SignalMap(t *testing.T) {
	cases := []struct {
		sig  int
		want string
	}{
		{5, "SIGTRAP"},
		{6, "SIGABRT"},
		{10, "SIGBUS"},
		{11, "SIGSEGV"},
		{9, "SIGKILL"},
		{0, ""},   // no signal → empty (don't fabricate)
		{99, ""},  // unknown → empty
	}
	for _, c := range cases {
		// string(rune(c.sig)) produced control chars which broke `go test -run`
		// path matching. fmt.Sprintf keeps subtest names addressable.
		name := fmt.Sprintf("sig_%d_%s", c.sig, c.want)
		t.Run(name, func(t *testing.T) {
			if got := signalName(c.sig); got != c.want {
				t.Errorf("signalName(%d) = %q, want %q", c.sig, got, c.want)
			}
		})
	}
}

func TestParseMetricKit_CallStackTreeFlatten(t *testing.T) {
	// Synthetic tree:
	//   root A → subFrame B → subFrame C
	//   root D (sibling root)
	// DFS leaves-first order (crash-site first) should produce: C, B, A, D.
	raw := []byte(`{
	  "diagnosticMetaData": {
	    "exceptionType": 1,
	    "bundleIdentifier": "com.example.MyApp",
	    "platformArchitecture": "arm64"
	  },
	  "callStackTree": {
	    "callStacks": [
	      {
	        "threadAttributed": true,
	        "callStackRootFrames": [
	          {"binaryUUID": "AABBCCDD-EEFF-0011-2233-445566778899", "offsetIntoBinaryTextSegment": 1, "binaryName": "A", "subFrames": [
	            {"binaryUUID": "AABBCCDD-EEFF-0011-2233-445566778899", "offsetIntoBinaryTextSegment": 2, "binaryName": "B", "subFrames": [
	              {"binaryUUID": "AABBCCDD-EEFF-0011-2233-445566778899", "offsetIntoBinaryTextSegment": 3, "binaryName": "C", "subFrames": []}
	            ]}
	          ]},
	          {"binaryUUID": "AABBCCDD-EEFF-0011-2233-445566778899", "offsetIntoBinaryTextSegment": 4, "binaryName": "D", "subFrames": []}
	        ]
	      }
	    ]
	  }
	}`)
	c, err := ParseMetricKit(raw)
	if err != nil {
		t.Fatalf("ParseMetricKit: %v", err)
	}
	if len(c.Threads) != 1 {
		t.Fatalf("threads = %d, want 1", len(c.Threads))
	}
	// Expected deep-to-shallow: C (offset 3), B (offset 2), A (offset 1), D (offset 4).
	// Siblings: the second root (D) is a separate root, appearing after the
	// first root's fully flattened subtree.
	got := make([]int, len(c.Threads[0].Frames))
	for i, f := range c.Threads[0].Frames {
		got[i] = f.ImageOffset
	}
	want := []int{3, 2, 1, 4}
	if !intSliceEqual(got, want) {
		t.Errorf("frame offsets = %v, want %v (leaf-first DFS then sibling)", got, want)
	}
}

func TestParseMetricKit_UsedImagesDedup(t *testing.T) {
	// Three frames all sharing one UUID should produce one UsedImage entry.
	raw := []byte(`{
	  "diagnosticMetaData": {"exceptionType": 1, "platformArchitecture": "arm64"},
	  "callStackTree": {"callStacks": [{"threadAttributed": true, "callStackRootFrames": [
	    {"binaryUUID": "AABBCCDD-EEFF-0011-2233-445566778899", "binaryName": "MyApp", "offsetIntoBinaryTextSegment": 1, "address": 1001, "subFrames": [
	      {"binaryUUID": "AABBCCDD-EEFF-0011-2233-445566778899", "binaryName": "MyApp", "offsetIntoBinaryTextSegment": 2, "address": 1002, "subFrames": [
	        {"binaryUUID": "AABBCCDD-EEFF-0011-2233-445566778899", "binaryName": "MyApp", "offsetIntoBinaryTextSegment": 3, "address": 1003, "subFrames": []}
	      ]}
	    ]}
	  ]}]}
	}`)
	c, err := ParseMetricKit(raw)
	if err != nil {
		t.Fatalf("ParseMetricKit: %v", err)
	}
	if len(c.UsedImages) != 1 {
		t.Errorf("usedImages = %d, want 1 (all frames share UUID)", len(c.UsedImages))
	}
}

func TestParseMetricKit_TerminationReasonParsed(t *testing.T) {
	// Apple emits terminationReason as "Namespace FOO, Code 0xBAR" — parser
	// extracts namespace and code so watchdog/user-quit rules can fire.
	raw := []byte(`{
	  "diagnosticMetaData": {
	    "exceptionType": 10,
	    "terminationReason": "Namespace FRONTBOARD, Code 0x8BADF00D",
	    "platformArchitecture": "arm64"
	  },
	  "callStackTree": {"callStacks": [{"threadAttributed": true, "callStackRootFrames": []}]}
	}`)
	c, err := ParseMetricKit(raw)
	if err != nil {
		t.Fatalf("ParseMetricKit: %v", err)
	}
	if c.Termination.Namespace != "FRONTBOARD" {
		t.Errorf("termination.namespace = %q, want FRONTBOARD", c.Termination.Namespace)
	}
	if c.Termination.Code != "0x8BADF00D" {
		t.Errorf("termination.code = %q, want 0x8BADF00D", c.Termination.Code)
	}
	if Categorize(c).RuleID != "R-watchdog-01" {
		t.Errorf("categorize = %q, want R-watchdog-01", Categorize(c).RuleID)
	}
}

func intSliceEqual(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// FuzzParseMetricKit seeds from every checked-in MetricKit JSON fixture and
// asserts that ParseMetricKit never panics on arbitrary input. Errors are
// fine. Budget: `make fuzz-metrickit` runs ≥60s; target ≥1M executions
// before release.
func FuzzParseMetricKit(f *testing.F) {
	const dir = "testdata/crashes/metrickit"
	entries, err := os.ReadDir(dir)
	if err != nil {
		f.Logf("seed dir %s: %v", dir, err)
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		f.Add(data)
	}
	f.Fuzz(func(t *testing.T, data []byte) {
		_, _ = ParseMetricKit(data)
	})
}
