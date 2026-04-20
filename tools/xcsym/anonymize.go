package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

// Redacted values — deliberately recognizable so a diff of before/after
// reads as "obviously scrubbed" rather than "might be another user's real
// data."
const (
	redactedBundleID = "com.example.redacted"
	redactedUserName = "REDACTED"
	redactedDevice   = "RedactedDevice"
	redactedIPv4     = "0.0.0.0"
	redactedIPv6     = "::0"
	zeroUUID         = "00000000-0000-0000-0000-000000000000"
)

// sensitiveKeys are JSON keys whose values are always PII regardless of where
// in the document they appear. String values get replaced by redacted
// equivalents; non-string values are left untouched. Context-sensitive keys
// (currently just "name") live in nameKeyParents, not here — see redactionFor.
var sensitiveKeys = map[string]string{
	// Bundle identifiers across v1/v2/MetricKit spellings.
	"bundle_id":          redactedBundleID,
	"bundleID":           redactedBundleID,
	"bundleIdentifier":   redactedBundleID,
	"CFBundleIdentifier": redactedBundleID,
	"codeSigningID":      redactedBundleID,
	"coalitionName":      redactedBundleID,
	"parentProc":         "launchd",
	"procName":           "MyApp",
	"app_name":           "MyApp",
	// binaryName is MetricKit's per-frame app-owning-binary label. Always a
	// candidate for redaction (it's the app's binary identity). Once the
	// symbolicate pipeline groups by UUID (axiom-mv5), scrubbing this no
	// longer breaks symbolication.
	"binaryName": "App",
	// Device/account identifiers.
	"crashReporterKey": zeroUUID,
	"sessionID":        zeroUUID,
	"incident_id":      zeroUUID,
	"incident":         zeroUUID,
	"deviceIdentifier": zeroUUID,
	"deviceUDID":       zeroUUID,
	"userID":           "501",
}

// nameKeyParents is the allowlist of parent-key contexts where a `name` key
// encodes PII (and therefore must be redacted). Other contexts — notably
// threads[].name ("com.apple.main-thread") and nested library identifiers —
// are Apple infrastructure labels useful for debugging, not PII. axiom-0h7.
//
// A parentKey of "" means the map is the document root. IPS v2 headers and
// IPS v1 blobs both carry the device name as a root-level `name`.
// "usedImages" is the array-parent when visiting a usedImages[i] map; the
// child `name` is the binary name.
var nameKeyParents = map[string]bool{
	"":           true, // v2 header / v1 root — device name
	"usedImages": true, // usedImages[i].name — binary name
}

// redactionFor returns (replacement, shouldRedact) for a key given its
// immediate parent-key context. parentKey is "" for the document root and
// the enclosing map's key (or the enclosing array's key, for items inside
// arrays) otherwise.
func redactionFor(key, parentKey string) (string, bool) {
	if repl, ok := sensitiveKeys[key]; ok {
		return repl, true
	}
	if key == "name" && nameKeyParents[parentKey] {
		return "App", true
	}
	return "", false
}

// uuidRE matches canonical 8-4-4-4-12 UUID strings (case-insensitive).
// Used to scrub "foreign" UUIDs embedded in freeform strings (e.g. paths,
// incident fields). dSYM UUIDs in usedImages are collected separately and
// excluded from replacement.
var uuidRE = regexp.MustCompile(`[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`)

// userPathRE matches /Users/<any>/ paths so we can redact the owner name.
// Matches /Users/ followed by a name component (no slashes) and a trailing
// slash. On macOS this reliably catches things like procPath and
// crashReporter paths; we deliberately don't touch /var/mobile/ paths (iOS)
// since those are bundle-path structural not personal.
var userPathRE = regexp.MustCompile(`/Users/[^/]+/`)

// ipv4RE matches basic dotted-quad IPv4 addresses. Kept simple because we
// aren't validating — we're scrubbing. 0.0.0.0 itself matches, which is
// fine since redacting a placeholder to a placeholder is a no-op.
var ipv4RE = regexp.MustCompile(`\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b`)

// appBundleRE matches `<appname>.app/<binary>` path fragments. The binary
// usually equals the app name on iOS (SecretApp.app/SecretApp); on macOS
// it's SecretApp.app/Contents/MacOS/SecretApp. One regex handles both by
// only consuming up to the next slash. Substituted with `App.app/App`.
var appBundleRE = regexp.MustCompile(`/([A-Za-z0-9_\-]+)\.app/([A-Za-z0-9_\-]+)`)

// bareBundleRE catches `<name>.app` occurrences not covered by the more
// specific path-plus-binary pattern (e.g. at end of a string with trailing
// slash stripped, or inside a log line). The trailing `\b` prevents
// false matches inside identifiers like "com.apple.main-thread" where
// "com.app" would otherwise capture — axiom-0h7.
var bareBundleRE = regexp.MustCompile(`([A-Za-z0-9_\-]+)\.app\b`)

// frameworkRE matches `<name>.framework` — Apple's convention for shared
// framework bundles. Framework names can reveal proprietary library names.
// Anchored to EOS or `/` so reverse-DNS identifiers like `com.framework.foo`
// don't get their middle segment mangled. `\b` (which bareBundleRE uses for
// `.app`) can't distinguish these cases because `.framework` is followed by
// `.` — a word boundary — so `\b` would still match. The accepted trade-off:
// a rare shape like `Foo.framework.dSYM` is NOT scrubbed, but the framework
// name inside it is already captured by sibling patterns elsewhere. axiom-9fl.
var frameworkRE = regexp.MustCompile(`([A-Za-z0-9_\-]+)\.framework(/|$)`)

// ipv6RE matches IPv6 addresses with 6+ colon-separated hex groups.
// We set the lower bound at 6 groups to avoid false-positive matches on
// three-digit timecodes, version strings, or UUIDs. Real IPv6 is mostly
// encountered in net logs and is rare in crash files — but when present it
// always has plenty of colons.
var ipv6RE = regexp.MustCompile(`\b(?:[0-9a-fA-F]{1,4}:){6,}[0-9a-fA-F]{1,4}\b`)

// Anonymize strips PII from a crash file while keeping the structural
// fields categorize and symbolicate rules depend on. Dispatches on
// DetectFormat.
func Anonymize(data []byte) ([]byte, error) {
	format := DetectFormat(data)
	switch format {
	case FormatIPSv1:
		return anonymizeIPSv1(data)
	case FormatIPSv2:
		return anonymizeIPSv2(data)
	case FormatMetricKit:
		return anonymizeMetricKit(data)
	}
	return nil, fmt.Errorf("anonymize: unsupported or unrecognized format")
}

func anonymizeIPSv1(data []byte) ([]byte, error) {
	var doc any
	if err := json.Unmarshal(data, &doc); err != nil {
		return nil, fmt.Errorf("anonymize ips v1: %w", err)
	}
	preserve := collectPreservedUUIDs(doc)
	anonymizeTree(doc, preserve)
	return marshalIndent(doc)
}

func anonymizeIPSv2(data []byte) ([]byte, error) {
	idx := bytes.IndexByte(data, '\n')
	if idx <= 0 {
		return nil, fmt.Errorf("anonymize ips v2: missing header/payload separator")
	}
	header := bytes.TrimSpace(data[:idx])
	payload := bytes.TrimSpace(data[idx+1:])

	var headerDoc, payloadDoc any
	if err := json.Unmarshal(header, &headerDoc); err != nil {
		return nil, fmt.Errorf("anonymize ips v2 header: %w", err)
	}
	if err := json.Unmarshal(payload, &payloadDoc); err != nil {
		return nil, fmt.Errorf("anonymize ips v2 payload: %w", err)
	}
	// Preserved UUIDs live in the payload's usedImages AND in the v2
	// header's slice_uuid field (same UUID as one of usedImages, but the
	// header walk needs its own visit to discover it). Collect from both
	// then apply the merged set to both halves.
	preserve := collectPreservedUUIDs(payloadDoc)
	for k := range collectPreservedUUIDs(headerDoc) {
		preserve[k] = true
	}
	anonymizeTree(headerDoc, preserve)
	anonymizeTree(payloadDoc, preserve)

	h, err := json.Marshal(headerDoc)
	if err != nil {
		return nil, err
	}
	p, err := json.MarshalIndent(payloadDoc, "", "  ")
	if err != nil {
		return nil, err
	}
	return bytes.Join([][]byte{h, p}, []byte{'\n'}), nil
}

func anonymizeMetricKit(data []byte) ([]byte, error) {
	var doc any
	if err := json.Unmarshal(data, &doc); err != nil {
		return nil, fmt.Errorf("anonymize metrickit: %w", err)
	}
	preserve := collectPreservedUUIDs(doc)
	anonymizeTree(doc, preserve)
	return marshalIndent(doc)
}

func marshalIndent(doc any) ([]byte, error) {
	return json.MarshalIndent(doc, "", "  ")
}

// collectPreservedUUIDs walks the doc and collects all UUIDs that must
// survive anonymization — specifically the ones in `usedImages[].uuid`
// (.ips) and `callStackRootFrames[...].binaryUUID` (MetricKit). These are
// dSYM correlation keys; redacting them would defeat the categorize tests
// that depend on dSYM presence.
func collectPreservedUUIDs(doc any) map[string]bool {
	out := make(map[string]bool)
	walkForUUIDs(doc, out)
	return out
}

func walkForUUIDs(v any, out map[string]bool) {
	switch vv := v.(type) {
	case map[string]any:
		// Only a small set of key names are legitimate dSYM UUID carriers.
		// Using a whitelist (vs. matching any key literally named "uuid")
		// keeps an accidentally-named nested field from smuggling an
		// unrelated UUID through the scrubber.
		for _, key := range []string{"uuid", "binaryUUID", "slice_uuid"} {
			if u, ok := vv[key].(string); ok && uuidRE.MatchString(u) {
				out[strings.ToUpper(u)] = true
			}
		}
		for _, sub := range vv {
			walkForUUIDs(sub, out)
		}
	case []any:
		for _, sub := range vv {
			walkForUUIDs(sub, out)
		}
	}
}

// anonymizeTree mutates doc in place: string values are regex-scrubbed;
// sensitive keys have their values replaced wholesale (when string-typed).
// Callers use the package entry points (anonymizeIPSv1 / anonymizeIPSv2 /
// anonymizeMetricKit) which start the walk at the document root.
func anonymizeTree(doc any, preserve map[string]bool) {
	anonymizeTreeAt(doc, preserve, "")
}

// anonymizeTreeAt is the path-aware recursion behind anonymizeTree.
// parentKey is "" at the document root and the enclosing map's key (for
// nested maps) or the array's key (for items inside arrays) otherwise.
// Context-sensitive redactions (currently `name`, see redactionFor) consult
// this to distinguish PII-bearing positions from Apple-infrastructure ones.
func anonymizeTreeAt(doc any, preserve map[string]bool, parentKey string) {
	switch v := doc.(type) {
	case map[string]any:
		for k, val := range v {
			if repl, ok := redactionFor(k, parentKey); ok {
				if _, isStr := val.(string); isStr {
					v[k] = repl
					continue
				}
			}
			switch sv := val.(type) {
			case string:
				v[k] = scrubString(sv, preserve)
			case map[string]any, []any:
				anonymizeTreeAt(sv, preserve, k)
			}
		}
	case []any:
		// Array items inherit the array's own parentKey — a child map of
		// usedImages[i] is still "inside usedImages" for the purposes of the
		// redactionFor check.
		for i, item := range v {
			switch sv := item.(type) {
			case string:
				v[i] = scrubString(sv, preserve)
			case map[string]any, []any:
				anonymizeTreeAt(sv, preserve, parentKey)
			}
		}
	}
}

// scrubString applies the regex-based PII substitutions to a single string
// value, honoring the preserve set so dSYM UUIDs come through untouched.
func scrubString(s string, preserve map[string]bool) string {
	// UUID scrubbing: replace each UUID not in the preserve set with zero.
	s = uuidRE.ReplaceAllStringFunc(s, func(match string) string {
		if preserve[strings.ToUpper(match)] {
			return match
		}
		return zeroUUID
	})
	// User paths.
	s = userPathRE.ReplaceAllString(s, "/Users/"+redactedUserName+"/")
	// App bundle / framework names. Specific-path form first (covers the
	// common "/SecretApp.app/SecretApp" suffix), then catch-all bare forms.
	s = appBundleRE.ReplaceAllString(s, "/App.app/App")
	s = bareBundleRE.ReplaceAllString(s, "App.app")
	s = frameworkRE.ReplaceAllString(s, "Framework.framework$2")
	// IPs — IPv6 first because the IPv4 pattern is looser.
	s = ipv6RE.ReplaceAllString(s, redactedIPv6)
	s = ipv4RE.ReplaceAllString(s, redactedIPv4)
	return s
}
