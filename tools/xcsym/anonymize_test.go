package main

import (
	"bytes"
	"os"
	"path/filepath"
	"regexp"
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
	  "exception": {"type":"EXC_BREAKPOINT","codes":"0x1","subtype":"Swift runtime failure: unexpectedly found nil while unwrapping an Optional value"},
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
	// Structural round-trip: anonymized output must still parse and the
	// categorize rule that depended on the subtype must still fire.
	raw, err := ParseIPS(out)
	if err != nil {
		t.Fatalf("reparse after anonymize: %v\n%s", err, string(out))
	}
	if Categorize(raw).RuleID != "R-swift-unwrap-01" {
		t.Errorf("v1 anonymize lost categorize signal: rule = %q", Categorize(raw).RuleID)
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

// TestAnonymize_v2_PreservesThreadNames guards axiom-0h7. Thread names like
// "com.apple.main-thread" are Apple-published infrastructure, not PII —
// scrubbing them to "App" lost debug context and previously confused the
// symbolicate pipeline when binaryName coincidentally matched. The fix makes
// the `name` key path-sensitive: redacted at the document root (device name)
// and inside usedImages[] (binary name), but preserved inside threads[] and
// anywhere else.
func TestAnonymize_v2_PreservesThreadNames(t *testing.T) {
	// Header has device name; payload has thread names AND a usedImages entry
	// whose .name must still be scrubbed.
	v2 := `{"app_name":"SecretApp","bundleID":"com.secretco.secret","bug_type":"309","os_version":"iOS 17","timestamp":"2026","name":"JohnsPhone"}
{"procName":"SecretApp","cpuType":"ARM-64","exception":{"type":"EXC_BAD_ACCESS","subtype":"KERN_INVALID_ADDRESS"},"faultingThread":0,"threads":[{"triggered":true,"name":"com.apple.main-thread","queue":"com.apple.main-thread","frames":[{"imageOffset":1,"imageIndex":0}]},{"name":"com.example.worker.queue","frames":[{"imageOffset":2,"imageIndex":0}]}],"usedImages":[{"source":"P","arch":"arm64","base":1,"size":1,"uuid":"AABBCCDD-EEFF-0011-2233-445566778899","name":"SecretApp","path":"/x"}]}`

	out, err := Anonymize([]byte(v2))
	if err != nil {
		t.Fatalf("Anonymize: %v", err)
	}

	// Device name at header root MUST be scrubbed.
	if bytes.Contains(out, []byte("JohnsPhone")) {
		t.Errorf("device name leaked through:\n%s", string(out))
	}
	// Binary name inside usedImages[] MUST be scrubbed.
	if bytes.Contains(out, []byte(`"name":"SecretApp"`)) {
		t.Errorf("usedImages name leaked through:\n%s", string(out))
	}
	// Thread names MUST be preserved (not PII; useful debug context). The
	// canonical Apple thread name "com.apple.main-thread" is the one the
	// ticket explicitly calls out — if it survives both the path-sensitive
	// `name` handling and the bare-bundle regex, we've fixed axiom-0h7.
	if !bytes.Contains(out, []byte("com.apple.main-thread")) {
		t.Errorf("thread name 'com.apple.main-thread' was scrubbed — it's not PII\n%s", string(out))
	}
	if !bytes.Contains(out, []byte("com.example.worker.queue")) {
		t.Errorf("user thread name was scrubbed — should pass through cleanly\n%s", string(out))
	}
	// Reparses cleanly after scrubbing so symbolicate/categorize still work.
	if _, err := ParseIPS(out); err != nil {
		t.Errorf("reparse after anonymize: %v\n%s", err, string(out))
	}
}

func TestAnonymize_v2_PreservesSliceUUIDInHeader(t *testing.T) {
	// .ips v2 headers carry slice_uuid which equals the main binary's
	// dSYM UUID. Anonymizer must treat it as preserve-worthy even though
	// it lives in the header (not in payload's usedImages).
	sliceUUID := "AABBCCDD-EEFF-0011-2233-445566778899"
	v2 := `{"app_name":"SecretApp","bundleID":"com.secretco.secret","bug_type":"309","slice_uuid":"` + sliceUUID + `","timestamp":"2026","os_version":"iOS 17"}
{"procName":"SecretApp","cpuType":"ARM-64","exception":{"type":"EXC_BAD_ACCESS","subtype":"KERN_INVALID_ADDRESS"},"faultingThread":0,"threads":[{"triggered":true,"frames":[{"imageOffset":1,"imageIndex":0}]}],"usedImages":[{"source":"P","arch":"arm64","base":1,"size":1,"uuid":"` + sliceUUID + `","name":"SecretApp","path":"/x"}]}`

	out, err := Anonymize([]byte(v2))
	if err != nil {
		t.Fatalf("Anonymize: %v", err)
	}
	if !bytes.Contains(out, []byte(sliceUUID)) {
		t.Errorf("slice_uuid in header was scrubbed; breaks correlation with usedImages\n%s", string(out))
	}
	// And usedImages side should also still carry it.
	ups := bytes.Count(out, []byte(sliceUUID))
	if ups < 2 {
		t.Errorf("expected slice_uuid in both header and usedImages (2 occurrences), found %d", ups)
	}
}

// TestScrubString_FrameworkRegexAnchored guards axiom-9fl. frameworkRE was
// `([A-Za-z0-9_\-]+)\.framework` — greedy-matched `.framework` anywhere,
// so `com.framework.foo` got captured and mangled to `Framework.framework.foo`.
//
// `\b` (which bareBundleRE uses for `.app`) can't fix this — `.framework`
// is followed by `.` in the false-positive case, and word-char to non-word
// char IS a word boundary. The real fix anchors frameworkRE to EOS or `/`,
// the only two legitimate terminators for an Apple framework bundle name.
//
// Trade-off documented on frameworkRE: `Foo.framework.dSYM` is no longer
// scrubbed. Acceptable because that shape is rare in .ips/MetricKit input
// and the framework name inside is already covered by sibling patterns.
func TestScrubString_FrameworkRegexAnchored(t *testing.T) {
	preserve := map[string]bool{}

	cases := []struct {
		name string
		in   string
		want string
	}{
		{"bare at EOS", "CoreFoo.framework", "Framework.framework"},
		{"before slash preserves path", "CoreFoo.framework/Helpers", "Framework.framework/Helpers"},
		{"interior segment must not match", "com.framework.foo", "com.framework.foo"},
		{"word-continuation must not match", "CoreFoo.frameworkTester", "CoreFoo.frameworkTester"},
		{"dot-continuation is the trade-off", "CoreFoo.framework.dSYM", "CoreFoo.framework.dSYM"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := scrubString(c.in, preserve); got != c.want {
				t.Errorf("scrubString(%q) = %q, want %q", c.in, got, c.want)
			}
		})
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
// against two complementary PII defenses:
//
//  1. Strict markers — words that would give away real data if they leaked
//     (e.g. "johndoe", "SecretApp"). Cheap first-pass guard against someone
//     copy-pasting a colleague's crash report as a test fixture.
//  2. Regex patterns — the plan's required categories: non-placeholder
//     bundle IDs, non-zero UUIDs, unredacted /Users/ paths, and non-zero
//     IPs. Catches shapes of real data even when the specific strings
//     aren't in the strict-marker list.
//
// Whitelists keep known-good placeholders (com.example.*, MyApp, REDACTED,
// zeroUUID) from triggering false positives. Both checks gate CI.
func TestAnonymize_NoRealPIIInTestdata(t *testing.T) {
	strictMarkers := []string{
		"johndoe",
		"JohnsPhone",
		"SecretApp",
		"com.secretco",
	}

	// Regex-based patterns. Go's regexp has no lookahead, so each match is
	// compared against a per-pattern whitelist of known-good placeholders.
	//
	// Bundle-ID shape: <reverseTLD>.<orgStartingWithLetter>.<rest>. The
	// enumerated TLD list (axiom-5fr) catches the common reverse-DNS
	// prefixes Apple ships apps under without resorting to a wildcard
	// `[a-z]{2,4}\.` that would false-positive on strings like
	// "swift.runtime.failure" or "co.exe". Three-segment minimum and the
	// letter-leading second segment further narrow the match.
	//
	// Excluded TLDs: 2-letter country codes that double as common English
	// words (in, at, be, it, no, us) and recent generic TLDs that appear in
	// .ips free-text (app, dev, co). co.uk-style bundles are still caught
	// because the second-level country code (uk, jp, za, …) is itself in
	// the list — `co.uk.example.app` matches starting at `uk.example.app`.
	bundleIDRE := regexp.MustCompile(
		`\b(com|org|net|io|edu|gov|mil|biz|info|cloud|` +
			`de|uk|jp|fr|es|nl|au|ca|cn|ru|br|mx|kr|se|fi|dk|pl|pt|ch|ie|nz|za)` +
			`\.[a-zA-Z][A-Za-z0-9_-]*\.[A-Za-z0-9_.-]+`)
	bundleIDWhitelist := map[string]bool{
		"com.example.MyApp":       true,
		"com.example.redacted":    true,
		"com.apple.CoreSimulator": true,
	}
	// Non-zero UUIDs. The zeroUUID sentinel and the canonical test UUID
	// "AABBCCDD-EEFF-0011-2233-445566778899" are both expected.
	anyUUIDRE := regexp.MustCompile(`[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`)
	// Whitelist contains structural test placeholders used across fixtures.
	// Each is visibly synthetic (repeating digits, sequential hex) — not real PII.
	uuidWhitelist := map[string]bool{
		"00000000-0000-0000-0000-000000000000": true,
		"AABBCCDD-EEFF-0011-2233-445566778899": true,
		"ABCDEF00-1111-2222-3333-444444444444": true,
		"11223344-5566-7788-99AA-BBCCDDEEFF00": true,
	}
	// /Users/ paths — must all be /Users/REDACTED/...
	userPathRE := regexp.MustCompile(`/Users/([A-Za-z0-9_.-]+)`)
	// IPv4 dotted-quad. The only acceptable value is 0.0.0.0 (redactedIPv4).
	ipv4RE := regexp.MustCompile(`\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b`)

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

		for _, banned := range strictMarkers {
			if bytes.Contains(data, []byte(banned)) {
				t.Errorf("fixture %s contains banned PII marker %q", path, banned)
			}
		}

		// Bundle IDs
		for _, m := range bundleIDRE.FindAllString(string(data), -1) {
			// Strip trailing punctuation that commonly comes from JSON
			// contexts (e.g., `com.example.MyApp"` → `com.example.MyApp`).
			trimmed := strings.TrimRight(m, `".,;:)`+"'")
			if bundleIDWhitelist[trimmed] {
				continue
			}
			// Allow sub-domain forms under com.example.* (e.g., com.example.MyApp.something).
			if strings.HasPrefix(trimmed, "com.example.") {
				continue
			}
			// Apple system bundle IDs are expected in .ips used_images paths.
			if strings.HasPrefix(trimmed, "com.apple.") {
				continue
			}
			t.Errorf("fixture %s contains unredacted bundle-ID-shaped string %q", path, trimmed)
		}

		// Non-zero UUIDs
		for _, u := range anyUUIDRE.FindAllString(string(data), -1) {
			upper := strings.ToUpper(u)
			if uuidWhitelist[upper] || uuidWhitelist[u] {
				continue
			}
			t.Errorf("fixture %s contains non-placeholder UUID %q", path, u)
		}

		// /Users/ paths must be /Users/REDACTED
		for _, m := range userPathRE.FindAllStringSubmatch(string(data), -1) {
			if m[1] != redactedUserName {
				t.Errorf("fixture %s contains unredacted /Users/ path (owner=%q)", path, m[1])
			}
		}

		// IPv4 — anything other than 0.0.0.0.
		for _, m := range ipv4RE.FindAllString(string(data), -1) {
			if m == redactedIPv4 {
				continue
			}
			// Allow memory-address-looking numbers that aren't real IPs from
			// being flagged — the regex is \b-bounded and length-limited, so
			// 255.255.255.255 would match but addresses like "0x1000" won't.
			t.Errorf("fixture %s contains non-redacted IPv4 %q", path, m)
		}

		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

// TestPIIScan_BundleIDRegexCatchesNonComPrefixes guards axiom-5fr. The
// PII-scan test in TestAnonymize_NoRealPIIInTestdata is meant to be the CI
// gate against real PII slipping into checked-in fixtures. The legacy
// `com\.[...]` regex caught only `com.*` bundle IDs, so any future fixture
// using `org.*`, `io.*`, `co.uk.*`, etc. would pass silently — defeating the
// guard the moment a non-com app vendor ships a real crash.
//
// This test pins the broadened regex by writing a synthetic fixture file
// inside a temp testdata layout, asserting the scan flags each non-com
// bundle ID. Running the scan against testdata/ directly would couple this
// test to the real fixture contents.
func TestPIIScan_BundleIDRegexCatchesNonComPrefixes(t *testing.T) {
	bundleIDRE := regexp.MustCompile(
		`\b(com|org|net|io|edu|gov|mil|biz|info|cloud|` +
			`de|uk|jp|fr|es|nl|au|ca|cn|ru|br|mx|kr|se|fi|dk|pl|pt|ch|ie|nz|za)` +
			`\.[a-zA-Z][A-Za-z0-9_-]*\.[A-Za-z0-9_.-]+`)

	cases := []struct {
		input string
		want  string // expected match (or "" for no match)
	}{
		{"io.realcompany.app", "io.realcompany.app"},
		{"org.example.thing", "org.example.thing"},
		{"co.uk.example.app", "uk.example.app"}, // co dropped (English ambiguity); uk catches it
		{"net.somevendor.tool", "net.somevendor.tool"},
		{"jp.somevendor.app", "jp.somevendor.app"},
		// Negative cases — strings that look bundle-ID-shaped but shouldn't
		// trip the regex (and would otherwise create noise on real .ips files).
		{"swift.runtime.failure", ""},               // tld 'swift' not enumerated
		{"main_thread_checker.dylib", ""},           // single dot, dylib suffix
		{"RunLoop in.dispatch.queue", ""},           // 'in' deliberately excluded
		{"loaded dev.fastlane.tools at", ""},        // 'dev' deliberately excluded
		{"thread us.foobar.example", ""},            // 'us' deliberately excluded
		{"com.example.MyApp", "com.example.MyApp"},  // matched (whitelist exempts)
	}
	for _, c := range cases {
		got := bundleIDRE.FindString(c.input)
		if got != c.want {
			t.Errorf("FindString(%q) = %q, want %q", c.input, got, c.want)
		}
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
