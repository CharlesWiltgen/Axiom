package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
)

// verifyOutput is the JSON emitted by `xcsym verify`.
type verifyOutput struct {
	Tool     string      `json:"tool"`
	Version  string      `json:"version"`
	Input    InputInfo   `json:"input"`
	Category string      `json:"category"` // all_matched | mismatch_uuid | mismatch_arch | partial
	Images   ImageStatus `json:"images"`
}

// runVerify implements `xcsym verify <file>`. Returns the intended exit code.
//
// Exit codes (see docs/xcsym-design.md):
//
//	0 all_matched
//	1 usage error
//	2 input not found / unreadable / unsupported format
//	3 any image has a UUID mismatch with its dSYM (explicit override only)
//	4 any image has an arch-slice mismatch with its dSYM
//	5 tool/discovery error
//	6 command timeout
//	7 any missing images (with or without matches)
//	8 output write error
func runVerify(out io.Writer, args []string) int {
	fs := flag.NewFlagSet("verify", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	dsym := fs.String("dsym", "", "explicit dSYM path override (bypasses discovery chain)")
	dsymPaths := fs.String("dsym-paths", "", "extra dSYM search roots (colon-separated)")
	noSpotlight := fs.Bool("no-spotlight", false, "skip Spotlight (mdfind) lookups")
	noCache := fs.Bool("no-cache", false, "skip the persistent UUID cache")
	if err := fs.Parse(args); err != nil {
		return 1
	}
	if fs.NArg() != 1 {
		fmt.Fprintln(os.Stderr, "verify: exactly one crash file required")
		return 1
	}
	path := fs.Arg(0)

	data, err := os.ReadFile(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "verify: cannot read %s: %v\n", path, err)
		return 2
	}
	format := DetectFormat(data)
	if format == FormatUnknown {
		fmt.Fprintf(os.Stderr, "verify: unsupported or unrecognized crash file: %s\n", path)
		return 2
	}
	images, err := ParseUsedImages(data, format)
	if err != nil {
		fmt.Fprintf(os.Stderr, "verify: %v\n", err)
		return 2
	}

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

	status, err := VerifyImages(context.Background(), d, &RawCrash{UsedImages: images})
	if err != nil {
		if IsTimeoutError(err) {
			fmt.Fprintf(os.Stderr, "verify: %v\n", err)
			return 6
		}
		fmt.Fprintf(os.Stderr, "verify: %v\n", err)
		return 5
	}

	result := verifyOutput{
		Tool:     "xcsym",
		Version:  version,
		Input:    InputInfo{Path: path, Format: format},
		Category: StatusCategory(status),
		Images:   status,
	}
	enc := json.NewEncoder(out)
	enc.SetIndent("", "  ")
	if err := enc.Encode(result); err != nil {
		fmt.Fprintf(os.Stderr, "verify: %v\n", err)
		return 8
	}

	switch result.Category {
	case "mismatch_uuid":
		return 3
	case "mismatch_arch":
		return 4
	case "partial":
		return 7
	}
	return 0
}

// splitPaths handles colon-separated search roots, stripping empty entries.
func splitPaths(raw string) []string {
	var out []string
	for _, p := range strings.Split(raw, ":") {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
