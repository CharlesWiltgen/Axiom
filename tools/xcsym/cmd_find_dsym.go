package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
)

// findDsymOutput is the JSON emitted by `xcsym find-dsym <uuid>`.
type findDsymOutput struct {
	Tool      string `json:"tool"`
	Version   string `json:"version"`
	UUID      string `json:"uuid"`
	Path      string `json:"path"`
	Arch      string `json:"arch"`
	ImageName string `json:"image_name"`
	Source    string `json:"source"`
}

// runFindDsym implements `xcsym find-dsym <uuid>`. Returns the exit code.
//
// Exit codes:
//
//	0 match — dSYM located
//	1 usage error
//	2 miss — nothing found across every discovery source
//	5 tool/discovery error
//	6 command timeout
//	8 output write error
func runFindDsym(out io.Writer, args []string) int {
	fs := flag.NewFlagSet("find-dsym", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	arch := fs.String("arch", "", "preferred arch slice (arm64, arm64e, x86_64)")
	dsymPaths := fs.String("dsym-paths", "", "extra dSYM search roots (colon-separated)")
	noSpotlight := fs.Bool("no-spotlight", false, "skip Spotlight (mdfind) lookups")
	noCache := fs.Bool("no-cache", false, "skip the persistent UUID cache")
	if err := fs.Parse(args); err != nil {
		return 1
	}
	if fs.NArg() != 1 {
		fmt.Fprintln(os.Stderr, "find-dsym: exactly one UUID required")
		return 1
	}
	uuid := NormalizeUUID(fs.Arg(0))

	opts := DiscovererOptions{
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

	entry, err := d.Find(context.Background(), uuid, *arch)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			fmt.Fprintf(os.Stderr, "find-dsym: no dSYM found for UUID %s\n", uuid)
			return 2
		}
		if IsTimeoutError(err) {
			fmt.Fprintf(os.Stderr, "find-dsym: %v\n", err)
			return 6
		}
		fmt.Fprintf(os.Stderr, "find-dsym: %v\n", err)
		return 5
	}

	result := findDsymOutput{
		Tool:      "xcsym",
		Version:   version,
		UUID:      entry.UUID,
		Path:      entry.Path,
		Arch:      entry.Arch,
		ImageName: entry.ImageName,
		Source:    entry.Source,
	}
	enc := json.NewEncoder(out)
	enc.SetIndent("", "  ")
	if err := enc.Encode(result); err != nil {
		fmt.Fprintf(os.Stderr, "find-dsym: %v\n", err)
		return 8
	}
	return 0
}
