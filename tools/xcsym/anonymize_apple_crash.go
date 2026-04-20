package main

import (
	"bufio"
	"bytes"
	"regexp"
	"strings"
)

// appleCrashHeaderRewrites maps header keys whose values are always PII to
// their deterministic replacements. The match is anchored to "Key:" so the
// rewriter can replay the key + inter-column padding untouched. Values that
// carry a pid in brackets (e.g. "Poppy [14250]") collapse to "[1]" — the
// exact pid isn't useful for fixtures and leaks a coarse device signal.
var appleCrashHeaderRewrites = []struct {
	key, replacement string
}{
	{"Process", "App [1]"},
	{"Identifier", redactedBundleID},
	{"Parent Process", "launchd [1]"},
	{"Coalition", redactedBundleID + " [1]"},
	{"Terminating Process", "App [1]"},
	{"Hardware Model", "RedactedDevice"},
	// AppVariant's third field is the device model code ("iPhone16,2"),
	// which the Hardware Model rewrite already scrubs — keeping it here
	// keeps the two fields in sync. The first and last fields are
	// storage/deployment target codes (not PII on their own), but we
	// replace the whole line anyway to avoid split-value leaks.
	{"AppVariant", "0:RedactedDevice:0"},
}

// appleCrashImageLineRE matches a Binary Images entry:
//
//	"        0xBASE -         0xEND NAME ARCH  <UUID> PATH"
//
// Used both for UUID extraction (preserve set) and, in the parser, for
// building UsedImages. The UUID capture group accepts the undashed 32-hex
// form Apple emits (`<a8a78540b3d93b69bba2e8766dbf3194>`) but also tolerates
// a dashed form for paranoia.
var appleCrashImageLineRE = regexp.MustCompile(
	`^\s*(0x[0-9a-fA-F]+)\s+-\s+(0x[0-9a-fA-F]+)\s+(\S+)\s+(\S+)\s+<([0-9a-fA-F-]+)>\s+(.+?)\s*$`,
)

// anonymizeAppleCrash scrubs PII from a legacy .crash text report. The
// strategy mirrors the JSON anonymizers: collect dSYM UUIDs from Binary
// Images first (preserve set), then pass each line through header
// rewrites + scrubString (shared with the JSON path). A final app-name
// word-boundary substitution catches the app's binary name where it
// appears as a column token in frames and Binary Images (`.app`-suffix
// forms are already handled by appBundleRE inside scrubString).
func anonymizeAppleCrash(data []byte) ([]byte, error) {
	preserve := collectAppleCrashPreservedUUIDs(data)
	appName := extractAppleCrashAppName(data)

	// Word-boundary regex for the app binary name. Compiled once so the
	// per-line loop doesn't pay the cost on every iteration. We compile
	// only when appName is non-empty and alphanumerical; otherwise we
	// skip the sub step entirely.
	var appNameRE *regexp.Regexp
	if isAlphaNumIdent(appName) {
		appNameRE = regexp.MustCompile(`\b` + regexp.QuoteMeta(appName) + `\b`)
	}

	lines := strings.Split(string(data), "\n")
	for i, line := range lines {
		if rewritten, ok := rewriteAppleCrashHeaderLine(line); ok {
			lines[i] = rewritten
			continue
		}
		// scrubString handles UUIDs (honoring preserve), /Users paths,
		// .app / .framework bundle names, and IP addresses.
		lines[i] = scrubString(line, preserve)
		if appNameRE != nil {
			lines[i] = appNameRE.ReplaceAllString(lines[i], "App")
		}
	}
	return []byte(strings.Join(lines, "\n")), nil
}

// rewriteAppleCrashHeaderLine returns the rewritten line and true when a
// header rule applies. Column padding after the colon is preserved so the
// anonymized output still looks like a .crash file (useful when a human
// needs to sanity-check a fixture). Returns "", false when no rule matches.
func rewriteAppleCrashHeaderLine(line string) (string, bool) {
	for _, rule := range appleCrashHeaderRewrites {
		prefix := rule.key + ":"
		if !strings.HasPrefix(line, prefix) {
			continue
		}
		tail := line[len(prefix):]
		// Preserve the run of spaces/tabs between the colon and the value.
		pad := 0
		for pad < len(tail) && (tail[pad] == ' ' || tail[pad] == '\t') {
			pad++
		}
		return prefix + tail[:pad] + rule.replacement, true
	}
	return "", false
}

// collectAppleCrashPreservedUUIDs walks the Binary Images section of a
// .crash text report and returns the set of dSYM UUIDs that must survive
// anonymization. Entries are added in both uppercase-dashed and
// uppercase-undashed forms so scrubString's preserve lookup (which uses
// the dashed form matched by uuidRE) finds them regardless of which
// form happens to show up in the document text.
//
// Note: .crash writes UUIDs in the undashed form (`<hex32>`) inside the
// Binary Images section, and uuidRE only matches the dashed form, so in
// practice scrubString won't touch Binary Images UUIDs even without a
// preserve set. The preserve set is defensive — it protects dSYM UUIDs
// that happen to be referenced in the dashed form somewhere else in the
// document (rare but possible in notes-style crash augmentations).
func collectAppleCrashPreservedUUIDs(data []byte) map[string]bool {
	out := make(map[string]bool)
	sc := bufio.NewScanner(bytes.NewReader(data))
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	inImages := false
	for sc.Scan() {
		line := sc.Text()
		trimmed := strings.TrimSpace(line)
		if !inImages {
			if strings.HasPrefix(trimmed, "Binary Images:") {
				inImages = true
			}
			continue
		}
		m := appleCrashImageLineRE.FindStringSubmatch(trimmed)
		if m == nil {
			continue
		}
		// m[5] is the UUID field (captured with or without dashes).
		u := strings.ToUpper(strings.ReplaceAll(m[5], "-", ""))
		if len(u) != 32 {
			continue
		}
		out[u] = true
		dashed := u[0:8] + "-" + u[8:12] + "-" + u[12:16] + "-" + u[16:20] + "-" + u[20:32]
		out[dashed] = true
	}
	return out
}

// extractAppleCrashAppName returns the process name from the "Process:"
// header line ("Poppy" from "Process: Poppy [14250]") or "" when it can't
// be read. The caller uses this to build a word-boundary regex that
// rewrites standalone occurrences of the app name in frames and Binary
// Images (where scrubString's bundle-path patterns don't reach).
func extractAppleCrashAppName(data []byte) string {
	sc := bufio.NewScanner(bytes.NewReader(data))
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		line := sc.Text()
		if !strings.HasPrefix(line, "Process:") {
			continue
		}
		rest := strings.TrimSpace(strings.TrimPrefix(line, "Process:"))
		// "Poppy [14250]" → "Poppy"
		if idx := strings.Index(rest, " "); idx > 0 {
			return rest[:idx]
		}
		return rest
	}
	return ""
}

// isAlphaNumIdent reports whether s is a reasonable app-name identifier
// for building a word-boundary regex. Refuses empty strings and anything
// containing characters that would make \b behavior unpredictable
// (spaces, quotes, regex metacharacters). App names that fail this check
// are skipped for the word-boundary substitution step — scrubString's
// bundle-path patterns still catch `.app/` forms.
func isAlphaNumIdent(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= 'A' && r <= 'Z':
		case r >= '0' && r <= '9':
		case r == '_' || r == '-':
		default:
			return false
		}
	}
	return true
}
