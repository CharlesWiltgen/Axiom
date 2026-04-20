package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// listDsymsOutput is the JSON emitted by `xcsym list-dsyms`. Each entry
// corresponds to one .dSYM bundle found on disk; uuids lists every UUID/arch
// pair the bundle carries (fat dSYMs have multiple).
type listDsymsOutput struct {
	Tool    string       `json:"tool"`
	Version string       `json:"version"`
	Roots   []string     `json:"roots"`
	Bundles []dsymBundle `json:"bundles"`
}

type dsymBundle struct {
	Path      string       `json:"path"`
	ImageName string       `json:"image_name"`
	Source    string       `json:"source"`
	UUIDs     []bundleUUID `json:"uuids"`
}

type bundleUUID struct {
	UUID string `json:"uuid"`
	Arch string `json:"arch"`
}

// runListDsyms implements `xcsym list-dsyms`. Returns the exit code.
//
// Exit codes:
//
//	0 success (zero bundles found is still success — empty list returned)
//	1 usage error
//	5 tool/discovery error
//	8 output write error
func runListDsyms(out io.Writer, args []string) int {
	fs := flag.NewFlagSet("list-dsyms", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	source := fs.String("source", "all", "which sources to scan: archives|deriveddata|downloads|toolchain|frameworks|env|all")
	dsymPaths := fs.String("dsym-paths", "", "extra dSYM search roots (colon-separated)")
	if err := fs.Parse(args); err != nil {
		return 1
	}

	opts := DiscovererOptions{}
	if *dsymPaths != "" {
		opts.UserPaths = splitPaths(*dsymPaths)
	}
	d := NewDiscovererFromEnv(opts)

	roots, err := rootsForSource(d, *source)
	if err != nil {
		fmt.Fprintf(os.Stderr, "list-dsyms: %v\n", err)
		return 1
	}

	bundles, err := scanDsymBundles(context.Background(), roots, *source)
	if err != nil {
		fmt.Fprintf(os.Stderr, "list-dsyms: %v\n", err)
		return 5
	}

	result := listDsymsOutput{
		Tool:    "xcsym",
		Version: version,
		Roots:   roots,
		Bundles: bundles,
	}
	enc := json.NewEncoder(out)
	enc.SetIndent("", "  ")
	if err := enc.Encode(result); err != nil {
		fmt.Fprintf(os.Stderr, "list-dsyms: %v\n", err)
		return 8
	}
	return 0
}

// rootsForSource returns the directories to scan for a given --source flag.
// "all" concatenates every non-Spotlight source — Spotlight isn't a
// directory walk so it doesn't fit the list-dsyms model.
func rootsForSource(d *Discoverer, source string) ([]string, error) {
	switch strings.ToLower(source) {
	case "archives":
		return d.opts.ArchivesPaths, nil
	case "deriveddata":
		return d.opts.DerivedDataPaths, nil
	case "downloads":
		return d.opts.DownloadsPaths, nil
	case "toolchain":
		return d.opts.ToolchainPaths, nil
	case "frameworks":
		return d.opts.FrameworkRoots, nil
	case "env":
		return d.opts.UserPaths, nil
	case "all":
		var out []string
		out = append(out, d.opts.ArchivesPaths...)
		out = append(out, d.opts.DerivedDataPaths...)
		out = append(out, d.opts.DownloadsPaths...)
		out = append(out, d.opts.ToolchainPaths...)
		out = append(out, d.opts.FrameworkRoots...)
		out = append(out, d.opts.UserPaths...)
		return out, nil
	}
	return nil, fmt.Errorf("unknown --source %q (want archives|deriveddata|downloads|toolchain|frameworks|env|all)", source)
}

// scanDsymBundles walks the given roots and returns every .dSYM bundle
// found, along with its UUIDs. Per-bundle probe failures are swallowed
// (e.g. stripped or malformed bundles) so one broken dSYM can't
// short-circuit the whole inventory.
func scanDsymBundles(ctx context.Context, roots []string, source string) ([]dsymBundle, error) {
	out := []dsymBundle{}
	seen := make(map[string]bool) // dedup by path
	for _, root := range roots {
		if root == "" {
			continue
		}
		if _, err := os.Stat(root); err != nil {
			continue
		}
		walkErr := filepath.WalkDir(root, func(path string, dir fs.DirEntry, err error) error {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if err != nil {
				// Permission denied on one subdir — skip it, keep walking.
				return filepath.SkipDir
			}
			if !dir.IsDir() || !strings.HasSuffix(path, ".dSYM") {
				return nil
			}
			if seen[path] {
				return filepath.SkipDir
			}
			seen[path] = true
			bundle, err := probeDsymBundle(ctx, path, sourceLabel(root, source))
			if err != nil {
				if IsTimeoutError(err) {
					return err
				}
				return filepath.SkipDir
			}
			if bundle != nil {
				out = append(out, *bundle)
			}
			return filepath.SkipDir
		})
		if walkErr != nil {
			return out, walkErr
		}
	}
	return out, nil
}

// sourceLabel returns a short string identifying which source the walk came
// from. When the user asked for --source=all, we don't try to reverse-map
// which defaults-path the root came from — we just report "all" to keep the
// labeling logic simple.
func sourceLabel(root, source string) string {
	return source
}

// probeDsymBundle inspects one .dSYM bundle and returns its contents, or nil
// when the bundle has no readable binary inside. Hard errors (tool timeouts,
// ctx cancellation) are returned so the caller can abort the walk.
func probeDsymBundle(ctx context.Context, path, source string) (*dsymBundle, error) {
	dwarf := filepath.Join(path, "Contents", "Resources", "DWARF")
	entries, err := os.ReadDir(dwarf)
	if err != nil {
		return nil, nil
	}
	var uuids []bundleUUID
	var imageName string
	for _, e := range entries {
		bin := filepath.Join(dwarf, e.Name())
		us, err := ReadUUIDs(ctx, bin)
		if err != nil {
			if isHardToolError(ctx, err) {
				return nil, err
			}
			continue
		}
		if imageName == "" {
			imageName = e.Name()
		}
		for _, u := range us {
			uuids = append(uuids, bundleUUID{UUID: u.UUID, Arch: u.Arch})
		}
	}
	if len(uuids) == 0 {
		return nil, nil
	}
	return &dsymBundle{
		Path:      path,
		ImageName: imageName,
		Source:    source,
		UUIDs:     uuids,
	}, nil
}
