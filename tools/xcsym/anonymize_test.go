package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// piiFixture is a synthetic .ips v2 with every PII category the anonymizer
// must scrub. The inline values are recognizable strings so failed
// assertions quote the exact bit that leaked through.
const piiFixture = `{"app_name":"SecretApp","timestamp":"2026-04-19","bundleID":"com.secretco.secret","bug_type":"309","os_version":"iOS 17.5","incident":"99999999-AAAA-BBBB-CCCC-DDDDEEEEFFFF","crashReporterKey":"11111111-2222-3333-4444-555555555555","name":"JohnsPhone"}
{"procName":"SecretApp","procPath":"/Users/johndoe/Library/Developer/CoreSimulator/Devices/11111111-2222-3333-4444-555555555555/data/Containers/Bundle/Application/77777777-8888-9999-AAAA-BBBBBBBBBBBB/SecretApp.app/SecretApp","cpuType":"ARM-64","coalitionName":"com.secretco.secret","codeSigningID":"com.secretco.secret","parentProc":"launchd","userID":501,"exception":{"type":"EXC_BREAKPOINT","codes":"0x1","subtype":"Swift runtime failure: unexpectedly found nil while unwrapping an Optional value","signal":"SIGTRAP"},"termination":{"namespace":"SIGNAL","code":5,"indicator":"Trace/BPT trap: 5"},"faultingThread":0,"threads":[{"triggered":true,"frames":[{"imageOffset":100,"symbol":"ContentView.body","imageIndex":0}]}],"usedImages":[{"source":"P","arch":"arm64","base":4294967296,"size":1048576,"uuid":"AABBCCDD-EEFF-0011-2233-445566778899","name":"SecretApp","path":"/Users/johndoe/SecretApp.app/SecretApp"}]}`

func TestAnonymize_v2_ScrubsKnownPII(t *testing.T) {
	out, err := Anonymize([]byte(piiFixture))
	if err != nil {
		t.Fatalf("Anonymize: %v", err)
	}

	// Structural: must still parse and categorize correctly after scrub.
	raw, err := ParseIPS(out)
	if err != nil {
		t.Fatalf("reparse after anonymize: %v\n%s", err, string(out))
	}
	if Categorize(raw).RuleID != "R-swift-unwrap-01" {
		t.Errorf("categorize after anonymize lost signal: %q", Categorize(raw).RuleID)
	}

	// dSYM UUID MUST survive — it's a correlation key.
	if !bytes.Contains(out, []byte("AABBCCDD-EEFF-0011-2233-445566778899")) {
		t.Errorf("dSYM UUID was redacted (it must be preserved)\n%s", string(out))
	}

	// Personal data patterns MUST all be gone.
	leaks := []string{
		"SecretApp",             // app name
		"com.secretco.secret",   // bundle ids
		"johndoe",               // username in path
		"99999999",              // incident UUID prefix
		"11111111-2222-3333",    // device UUID prefix
		"77777777-8888-9999",    // installation UUID prefix
		"JohnsPhone",            // device name
	}
	for _, leak := range leaks {
		if bytes.Contains(out, []byte(leak)) {
			t.Errorf("PII leaked through: %q still present in output", leak)
		}
	}

	// Redacted sentinels that should show up as replacements.
	wants := []string{
		redactedBundleID,             // com.example.redacted
		"/Users/" + redactedUserName, // user path replacement
		zeroUUID,                     // at least one scrubbed UUID
	}
	for _, w := range wants {
		if !bytes.Contains(out, []byte(w)) {
			t.Errorf("expected redaction sentinel %q not found in output\n%s", w, string(out))
		}
	}
}

func TestAnonymize_v1_Works(t *testing.T) {
	// Same PII markers but as v1 single-blob.
	v1Raw := `{
	  "app_name": "SecretApp",
	  "bundle_id": "com.secretco.secret",
	  "bug_type": "309",
	  "cpuType": "ARM-64",
	  "incident_id": "99999999-AAAA-BBBB-CCCC-DDDDEEEEFFFF",
	  "exception": {"type":"EXC_BAD_ACCESS","subtype":"KERN_INVALID_ADDRESS"},
	  "faultingThread": 0,
	  "threads": [{"triggered":true,"frames":[{"imageOffset":100,"imageIndex":0}]}],
	  "usedImages": [{"uuid":"AABBCCDD-EEFF-0011-2233-445566778899","name":"SecretApp","path":"/Users/johndoe/x","arch":"arm64","base":0,"size":0}]
	}`
	out, err := Anonymize([]byte(v1Raw))
	if err != nil {
		t.Fatalf("Anonymize: %v", err)
	}
	if bytes.Contains(out, []byte("johndoe")) {
		t.Errorf("v1 anonymize missed /Users/johndoe/:\n%s", string(out))
	}
	if bytes.Contains(out, []byte("com.secretco.secret")) {
		t.Errorf("v1 anonymize missed bundle_id:\n%s", string(out))
	}
	if !bytes.Contains(out, []byte("AABBCCDD-EEFF-0011-2233-445566778899")) {
		t.Errorf("v1 dropped dSYM UUID")
	}
}

func TestAnonymize_MetricKit(t *testing.T) {
	// MetricKit path: PII in diagnosticMetaData + callStack binaryUUID is
	// preserved while other fields scrub.
	mk := `{
	  "diagnosticMetaData": {
	    "exceptionType": 1,
	    "bundleIdentifier": "com.secretco.secret",
	    "platformArchitecture": "arm64"
	  },
	  "callStackTree": {
	    "callStacks": [{
	      "threadAttributed": true,
	      "callStackRootFrames": [{
	        "binaryUUID": "AABBCCDD-EEFF-0011-2233-445566778899",
	        "binaryName": "SecretApp",
	        "offsetIntoBinaryTextSegment": 100,
	        "subFrames": []
	      }]
	    }]
	  }
	}`
	out, err := Anonymize([]byte(mk))
	if err != nil {
		t.Fatalf("Anonymize: %v", err)
	}
	if bytes.Contains(out, []byte("com.secretco.secret")) {
		t.Errorf("MetricKit anonymize missed bundleIdentifier:\n%s", string(out))
	}
	if !bytes.Contains(out, []byte("AABBCCDD-EEFF-0011-2233-445566778899")) {
		t.Errorf("MetricKit dropped binaryUUID (must be preserved)")
	}
}

func TestAnonymize_IPv4AndIPv6(t *testing.T) {
	blob := `{
	  "bug_type": "309",
	  "usedImages": [],
	  "exception": {"type": "EXC_BAD_ACCESS"},
	  "notes": ["peer at 10.0.0.42", "listener :: 2001:0db8:85a3:0000:0000:8a2e:0370:7334"]
	}`
	out, err := Anonymize([]byte(blob))
	if err != nil {
		t.Fatalf("Anonymize: %v", err)
	}
	if bytes.Contains(out, []byte("10.0.0.42")) {
		t.Errorf("IPv4 leaked through:\n%s", string(out))
	}
	if bytes.Contains(out, []byte("2001:0db8:85a3")) {
		t.Errorf("IPv6 leaked through:\n%s", string(out))
	}
	if !bytes.Contains(out, []byte(redactedIPv4)) {
		t.Errorf("expected %q sentinel not present\n%s", redactedIPv4, string(out))
	}
}

// TestAnonymize_NoRealPIIInTestdata scans every checked-in crash fixture
// and fails if a known PII *marker* appears. This guards against someone
// committing a real user's crash report as a test fixture. The markers are
// the words that would give away real data if they leaked; placeholders
// like "com.example.MyApp" are whitelisted.
func TestAnonymize_NoRealPIIInTestdata(t *testing.T) {
	// Walk every file under testdata/crashes.
	err := filepath.Walk("testdata/crashes", func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		for _, banned := range []string{
			"johndoe",
			"JohnsPhone",
			"SecretApp",
			"com.secretco",
			// Other plausible leak markers — add as needed if real fixtures
			// are imported later.
		} {
			if bytes.Contains(data, []byte(banned)) {
				t.Errorf("fixture %s contains banned PII marker %q", path, banned)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestRunAnonymize_UsageErrors(t *testing.T) {
	var buf bytes.Buffer
	if code := runAnonymize(&buf, []string{}); code != 1 {
		t.Errorf("no args: code = %d, want 1", code)
	}
}

func TestRunAnonymize_WritesOutputFile(t *testing.T) {
	inPath := filepath.Join(t.TempDir(), "in.ips")
	if err := os.WriteFile(inPath, []byte(piiFixture), 0o644); err != nil {
		t.Fatal(err)
	}
	outPath := filepath.Join(t.TempDir(), "out.ips")
	var buf bytes.Buffer
	code := runAnonymize(&buf, []string{"--output", outPath, inPath})
	if code != 0 {
		t.Fatalf("code = %d\n%s", code, buf.String())
	}
	if buf.Len() != 0 {
		t.Errorf("stdout should be empty with --output, got %q", buf.String())
	}
	data, err := os.ReadFile(outPath)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(data, []byte("SecretApp")) {
		t.Errorf("output file still contains PII")
	}
	// Output should still be valid JSON (for v2: header JSON + payload JSON).
	if !strings.Contains(string(data), "\n") {
		t.Errorf("v2 anonymized output missing header/payload separator newline")
	}
}
