package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
)

// crashRejectPayload is the JSON shape emitted when the crash file isn't a
// crash we can analyze (hang, non-fatal EXC_RESOURCE). Keeps exit 1 output
// machine-readable so callers can route.
type crashRejectPayload struct {
	Tool    string `json:"tool"`
	Version string `json:"version"`
	Error   string `json:"error"`
	Message string `json:"message"`
	Input   string `json:"input,omitempty"`
	Routing string `json:"routing,omitempty"`
}

// runCrash implements `xcsym crash <file>`. Returns the intended exit code.
//
// Exit codes:
//
//	0 success — no missing/mismatched images
//	1 usage error OR hang/non-fatal-resource report (see JSON "error" field)
//	2 input not found / main binary missing
//	3 any Mismatched (UUID) — or main mismatch (UUID)
//	4 any Mismatched (arch) with dSYM present
//	5 tool/discovery error
//	6 command timeout
//	7 main binary matched but other images missing/mismatched
//	8 output write error
func runCrash(out io.Writer, args []string) int {
	fs := flag.NewFlagSet("crash", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	format := fs.String("format", TierStandard, "output tier: summary|standard|full")
	fromMetrickit := fs.Bool("from-metrickit", false, "force MetricKit format (skip auto-detect)")
	dsym := fs.String("dsym", "", "explicit dSYM path override (for the main app binary)")
	dsymPaths := fs.String("dsym-paths", "", "extra dSYM search roots (colon-separated)")
	noSpotlight := fs.Bool("no-spotlight", false, "skip Spotlight (mdfind) lookups")
	noCache := fs.Bool("no-cache", false, "skip the persistent UUID cache")
	noSymbolicate := fs.Bool("no-symbolicate", false, "skip atos calls; keep frames as parsed")
	outputPath := fs.String("output", "", "write JSON to this path instead of stdout")
	filterMatch := fs.String("filter", "", "for .xccrashpoint inputs: pick the Filter_* dir whose name contains this substring (default: most-recent-mtime)")
	preferLocallySymbolicated := fs.Bool("prefer-locally-symbolicated", false, "for .xccrashpoint inputs: pick Logs/LocallySymbolicated/*.crash instead of the raw Logs/*.crash (raw preserves original UUIDs for dSYM verify)")
	if err := fs.Parse(args); err != nil {
		return 1
	}
	if fs.NArg() != 1 {
		// Common footgun: "xcsym crash file.crash --no-symbolicate" stops
		// flag parsing at the first positional, so the trailing flags
		// become extra positionals and we land here. Tell the user how to
		// rephrase rather than just complain about arg count.
		if fs.NArg() > 1 {
			fmt.Fprintln(os.Stderr, "crash: extra arguments after the crash file — place all --flags before the file path (e.g. `xcsym crash --no-symbolicate file.crash`)")
			return 1
		}
		fmt.Fprintln(os.Stderr, "crash: exactly one crash file required (use '-' for stdin)")
		return 1
	}
	tier := *format
	switch tier {
	case TierSummary, TierStandard, TierFull:
	default:
		fmt.Fprintf(os.Stderr, "crash: unknown --format %q (want summary|standard|full)\n", tier)
		return 1
	}

	path := fs.Arg(0)
	var data []byte
	var err error
	bundlePath := ""
	if path == "-" {
		data, err = io.ReadAll(os.Stdin)
		if err != nil {
			fmt.Fprintf(os.Stderr, "crash: read stdin: %v\n", err)
			return 2
		}
	} else {
		if IsXccrashpointPath(path) {
			res, resolveErr := ResolveXccrashpoint(path, xccrashpointResolveOptions{
				FilterMatch:               *filterMatch,
				PreferLocallySymbolicated: *preferLocallySymbolicated,
			})
			if errors.Is(resolveErr, errNotXccrashpoint) {
				// Distinct from "unsupported_format" (which means "wrong file
				// type") so agents can route differently — this user has the
				// right *kind* of input, the bundle is just missing/empty.
				fmt.Fprintf(os.Stderr, "crash: %v: %s\n", resolveErr, path)
				return writeReject(out, *outputPath, crashRejectPayload{
					Tool: "xcsym", Version: version,
					Error:   "empty_bundle",
					Message: resolveErr.Error(),
					Input:   path,
					Routing: "Bundle is empty or doesn't follow the Xcode Organizer layout (Filters/Filter_*/Logs/*.crash). Point xcsym at a specific .crash file inside the bundle, or pull a fresh crash from the Organizer.",
				}, 2)
			}
			if resolveErr != nil {
				// Real I/O error (permission denied, stale NFS, etc.) — surface
				// as a tool error per the shared exit-code contract; don't
				// pretend the bundle is empty.
				fmt.Fprintf(os.Stderr, "crash: resolve %s: %v\n", path, resolveErr)
				return 5
			}
			bundlePath = res.BundlePath
			path = res.CrashPath
		}
		data, err = os.ReadFile(path)
		if err != nil {
			fmt.Fprintf(os.Stderr, "crash: cannot read %s: %v\n", path, err)
			return 2
		}
	}

	// Detect format.
	detected := DetectFormat(data)
	if *fromMetrickit {
		detected = FormatMetricKit
	}

	// Parse.
	raw, err := parseByFormat(data, detected)
	if err != nil {
		var he *HangError
		if errors.As(err, &he) {
			return writeReject(out, *outputPath, crashRejectPayload{
				Tool: "xcsym", Version: version,
				Error:   "hang_report",
				Message: "Crash file is a hang report (bug_type=" + he.BugType + "); this tool analyzes crashes, not hangs.",
				Input:   path,
				Routing: "Use Apple's 'Hangs' instrument or a hang-report analyzer instead.",
			}, 1)
		}
		// Unrecognized/unsupported formats: emit a structured JSON reject on
		// stdout so agents can route on `error` instead of scraping stderr,
		// and exit 2 per the shared "input not found / unsupported format"
		// contract (see xcsym-ref.md exit code table). The stderr copy is
		// kept for humans running the CLI interactively.
		fmt.Fprintf(os.Stderr, "crash: parse: %v\n", err)
		return writeReject(out, *outputPath, crashRejectPayload{
			Tool: "xcsym", Version: version,
			Error:   "unsupported_format",
			Message: err.Error(),
			Input:   path,
			Routing: "xcsym crash accepts .ips (v1/v2), MetricKit JSON, and Apple's legacy .crash text format. Convert other formats first or use a different tool.",
		}, 2)
	}
	raw.Format = detected // make sure Format field agrees with detect outcome

	// Categorize once, up front. The non-fatal-resource gate needs to know
	// whether R-swiftui-loop-01 fires, and the formatter needs the result
	// downstream — double-categorization is wasted work on deep full-tier
	// payloads.
	cat := Categorize(raw)

	if reason := nonFatalResourceReason(raw, cat); reason != "" {
		return writeReject(out, *outputPath, crashRejectPayload{
			Tool: "xcsym", Version: version,
			Error:   "non_fatal_resource",
			Message: reason,
			Input:   path,
			Routing: "Non-fatal EXC_RESOURCE diagnostics (CPU warnings, wakeups) need a performance analyzer, not a crash reporter.",
		}, 1)
	}

	// Discover dSYMs / verify images.
	ctx := context.Background()
	opts := DiscovererOptions{
		Explicit:      *dsym,
		SkipSpotlight: *noSpotlight,
		SkipCache:     *noCache,
		NegCacheTTL:   DefaultNegCacheTTLSeconds(),
	}
	if *dsymPaths != "" {
		opts.UserPaths = splitPaths(*dsymPaths)
	}
	if !opts.SkipCache {
		opts.CacheDir = DefaultCacheDir()
		opts.Cache = NewCache(opts.CacheDir)
	}
	d := NewDiscovererFromEnv(opts)
	status, err := VerifyImages(ctx, d, raw)
	if err != nil {
		if IsTimeoutError(err) {
			fmt.Fprintf(os.Stderr, "crash: %v\n", err)
			return 6
		}
		fmt.Fprintf(os.Stderr, "crash: verify images: %v\n", err)
		return 5
	}

	// Symbolicate. Warnings describe per-image failures (dSYM miss, atos
	// timeout, atos returned no symbols) so the user can tell what happened
	// instead of just seeing `"symbolicated": false` on frames. axiom-ogk.
	var symbolicateWarnings []string
	if !*noSymbolicate {
		symbolicateWarnings = SymbolicateForTier(ctx, raw, status, d, tier)
	}

	// Environment snapshot. Best-effort — a failure here isn't worth blocking
	// the whole report (the user might be on a system without Xcode).
	env, _ := CaptureEnvironment(ctx)
	env.CLTVersionShort = shortenCLT(env.CLTVersion)

	// Compose report.
	report, err := Format(raw, status, env, InputInfo{Path: path, Format: detected, Bundle: bundlePath}, cat, tier)
	if err != nil {
		fmt.Fprintf(os.Stderr, "crash: format: %v\n", err)
		return 5
	}
	if len(symbolicateWarnings) > 0 {
		report.Warnings = append(report.Warnings, symbolicateWarnings...)
	}

	// Emit JSON.
	if err := writeJSON(out, *outputPath, report); err != nil {
		fmt.Fprintf(os.Stderr, "crash: %v\n", err)
		return 8
	}

	return crashExitCode(raw, status)
}

// parseByFormat dispatches on detected format and invokes the matching parser.
func parseByFormat(data []byte, format string) (*RawCrash, error) {
	switch format {
	case FormatIPSv1, FormatIPSv2:
		return ParseIPS(data)
	case FormatMetricKit:
		return ParseMetricKit(data)
	case FormatAppleCrash:
		return ParseAppleCrash(data)
	}
	return nil, fmt.Errorf("unsupported or unrecognized crash format")
}

// nonFatalResourceReason returns a human-readable reason when the crash is a
// non-fatal EXC_RESOURCE warning (CPU usage warnings, wakeups warnings).
// Returns "" when the crash is a real crash that should flow through the
// pipeline. Takes a pre-computed CategorizeResult so the caller's existing
// categorize pass is reused rather than re-run.
func nonFatalResourceReason(raw *RawCrash, cat CategorizeResult) string {
	if raw.Exception.Type != "EXC_RESOURCE" {
		return ""
	}
	sub := raw.Exception.Subtype
	// The SwiftUI loop rule fires on (CPU WARNING) reports too. Let those
	// through so the user sees the loop diagnosis.
	if cat.RuleID == "R-swiftui-loop-01" {
		return ""
	}
	// FATAL and NON-FATAL spellings — reject NON-FATAL, let FATAL flow through
	// (R-cpu-fatal-01 will tag it).
	if strings.Contains(sub, "NON-FATAL") {
		return "Crash file is a non-fatal EXC_RESOURCE diagnostic (" + sub + ")."
	}
	if strings.Contains(sub, "WARNING") {
		return "Crash file is an EXC_RESOURCE warning (" + sub + "), not a crash."
	}
	return ""
}

// crashExitCode computes the process exit code from image-match outcomes.
// Main binary = the first used image (UUID is the correlation key — name
// can differ between app_name header field and actual bundle binary name,
// so name-matching would silently drop mains whose display name and
// binary name diverge). See plan Phase 8 Task 32 for the exit-code table.
func crashExitCode(raw *RawCrash, status ImageStatus) int {
	if len(raw.UsedImages) == 0 {
		return 0
	}
	mainUUID := raw.UsedImages[0].UUID

	var mainMatched, mainMissing bool
	for _, m := range status.Matched {
		if m.UUID == mainUUID {
			mainMatched = true
			break
		}
	}
	for _, m := range status.Missing {
		if m.UUID == mainUUID {
			mainMissing = true
			break
		}
	}
	if mainMissing {
		return 2
	}

	// Main mismatches take priority over other-image mismatches.
	for _, m := range status.Mismatched {
		if m.UUID == mainUUID {
			if m.Kind == MismatchArch {
				return 4
			}
			return 3
		}
	}

	if mainMatched && (len(status.Missing) > 0 || len(status.Mismatched) > 0) {
		return 7
	}

	// Scan remaining mismatches — prefer UUID mismatch over arch mismatch.
	var hasUUID, hasArch bool
	for _, m := range status.Mismatched {
		switch m.Kind {
		case MismatchUUID:
			hasUUID = true
		case MismatchArch:
			hasArch = true
		}
	}
	if hasUUID {
		return 3
	}
	if hasArch {
		return 4
	}
	if len(status.Missing) > 0 {
		return 7
	}
	return 0
}

// writeJSON marshals payload and writes it either to outputPath (when set)
// or to out (stdout). Errors are returned as-is so the caller can map to
// exit code 8.
func writeJSON(out io.Writer, outputPath string, payload any) error {
	var w io.Writer = out
	if outputPath != "" {
		f, err := os.Create(outputPath)
		if err != nil {
			return err
		}
		defer f.Close()
		w = f
	}
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(payload)
}

// writeReject emits a rejection payload and returns the caller-supplied
// exit code (1 for "tool intentionally refused" cases like hang reports
// and non-fatal resource diagnostics; 2 for unsupported/unrecognized
// input formats, mirroring the shared exit-code contract in xcsym-ref.md).
// If output writing fails we downgrade to exit 8 so the caller can
// distinguish "tool intentionally refused" from "io problem".
func writeReject(out io.Writer, outputPath string, payload crashRejectPayload, code int) int {
	if err := writeJSON(out, outputPath, payload); err != nil {
		fmt.Fprintf(os.Stderr, "crash: %v\n", err)
		return 8
	}
	return code
}

// shortenCLT squeezes "Xcode 16.0 Build version 16A5171r" → "Xcode 16.0".
// A first-line-first-three-words approximation — good enough for the
// summary tier's clt_version_short field.
func shortenCLT(full string) string {
	if full == "" {
		return ""
	}
	line := strings.SplitN(full, "\n", 2)[0]
	line = strings.TrimSpace(line)
	parts := strings.Fields(line)
	if len(parts) >= 2 && parts[0] == "Xcode" {
		return "Xcode " + parts[1]
	}
	return line
}
