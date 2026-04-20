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

// sensitiveKeys are JSON keys whose values are always PII regardless of
// content. Value type is tolerated (strings, numbers, nested) but string
// values get replaced by redacted equivalents.
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
	// "name" appears in v2 headers as the device name ("JohnsPhone"), and
	// in usedImages/binaryName as the binary filename. Both are leak paths —
	// device names are obvious PII, and binary names often reveal app names.
	// The UUID is the correlation key we care about; the name is cosmetic
	// after anonymization.
	"name":       "App",
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
// slash stripped, or inside a log line).
var bareBundleRE = regexp.MustCompile(`([A-Za-z0-9_\-]+)\.app`)

// frameworkRE matches `<name>.framework` — Apple's convention for shared
// framework bundles. Framework names can reveal proprietary library names.
var frameworkRE = regexp.MustCompile(`([A-Za-z0-9_\-]+)\.framework`)

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
func anonymizeTree(doc any, preserve map[string]bool) {
	switch v := doc.(type) {
	case map[string]any:
		for k, val := range v {
			if repl, ok := sensitiveKeys[k]; ok {
				if _, isStr := val.(string); isStr {
					v[k] = repl
					continue
				}
			}
			switch sv := val.(type) {
			case string:
				v[k] = scrubString(sv, preserve)
			case map[string]any, []any:
				anonymizeTree(sv, preserve)
			}
		}
	case []any:
		for i, item := range v {
			switch sv := item.(type) {
			case string:
				v[i] = scrubString(sv, preserve)
			case map[string]any, []any:
				anonymizeTree(sv, preserve)
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
	s = frameworkRE.ReplaceAllString(s, "Framework.framework")
	// IPs — IPv6 first because the IPv4 pattern is looser.
	s = ipv6RE.ReplaceAllString(s, redactedIPv6)
	s = ipv4RE.ReplaceAllString(s, redactedIPv4)
	return s
}
