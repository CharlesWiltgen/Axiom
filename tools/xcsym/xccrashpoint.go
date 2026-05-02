package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// .xccrashpoint is the directory bundle the Xcode Organizer hands developers
// when they pull a crash off TestFlight or App Store Connect. Layout:
//
//	Foo.xccrashpoint/
//	└── Filters/
//	    └── Filter_<id>-<version>-<platform>-Any/
//	        ├── DistributionInfo.json
//	        ├── PointInfo.json
//	        └── Logs/
//	            ├── <timestamp>-<hash>.crash               (raw .crash text)
//	            └── LocallySymbolicated/
//	                └── <timestamp>-<hash>.crash           (Xcode-symbolicated)
//
// xcsym originally treated all inputs as files, so .xccrashpoint paths failed
// at os.ReadFile with "is a directory". This file teaches xcsym to walk the
// bundle structure and pick a .crash file, while letting downstream callers
// see both the resolved file and the original bundle path in the JSON.

const XccrashpointBundleSuffix = ".xccrashpoint"

type xccrashpointResolveOptions struct {
	// FilterMatch is a substring matched against the Filter_* directory name.
	// Substring (not segment-anchored) so a user can pass a partial version
	// like "1.2" and match "Filter_x-1.2.0-Any"; the trade-off is "1.0" also
	// matches "11.0.0", so prefer dash-bounded fragments like "0.8.60-Any".
	// Empty selects all and falls back to most-recent-mtime.
	FilterMatch string

	// PreferLocallySymbolicated picks Logs/LocallySymbolicated/*.crash when
	// present. Defaults to false so dSYM verify sees the raw frames; flip
	// when the user just wants Xcode's pre-resolved frames or the raw copy
	// is missing.
	PreferLocallySymbolicated bool
}

type xccrashpointResolution struct {
	BundlePath string // original .xccrashpoint path (absolute)
	FilterDir  string // chosen Filter_* directory (absolute)
	CrashPath  string // chosen .crash file (absolute)
}

// errNotXccrashpoint signals that the path is a directory but not a bundle
// xcsym knows how to walk. Callers convert this to the structured
// "empty_bundle" reject so agents can route on JSON.
var errNotXccrashpoint = errors.New("directory is not a recognized .xccrashpoint bundle")

// IsXccrashpointPath returns true when path looks like an Xcode crash bundle.
// Suffix matched case-insensitively because APFS/HFS+ are case-insensitive
// by default — a bundle round-tripped through Finder/zip/iCloud can come
// back as Foo.XCCrashpoint and would otherwise be silently rejected.
//
// Accepts any directory whose name ends in .xccrashpoint — even one missing
// its inner Filters/ tree — so the caller can emit a useful "bundle is
// empty/corrupt" reject instead of a generic "is a directory" error. Walk
// failures surface at ResolveXccrashpoint time.
func IsXccrashpointPath(path string) bool {
	if !strings.EqualFold(filepath.Ext(path), XccrashpointBundleSuffix) {
		return false
	}
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}

// ResolveXccrashpoint walks bundlePath/Filters/*/Logs/ and returns the chosen
// .crash file.
//
// Error contract:
//   - errNotXccrashpoint: bundle layout is missing (no Filters/, no Filter_*
//     dirs, or no .crash files anywhere). Caller should emit a structured
//     "empty_bundle" reject.
//   - Other errors: real I/O problems (permission denied, stale NFS handle,
//     etc.). Caller should surface as a tool error rather than misdirect
//     the user into "your bundle is corrupt" territory.
//
// Selection algorithm:
//
//  1. Enumerate Filters/Filter_*/. If FilterMatch is set, keep only entries
//     whose directory name contains the substring.
//  2. Sort surviving Filter dirs by modification time, newest first.
//  3. Walk each candidate's Logs/ in order. The first one with a usable
//     .crash file wins — a bundle whose newest Filter has no .crash but an
//     older one does is unusual but real (e.g. partial Xcode export).
//  4. PreferLocallySymbolicated picks Logs/LocallySymbolicated/*.crash;
//     otherwise Logs/*.crash directly. If the preferred copy is missing,
//     fall through to the other one rather than fail — the user gave us a
//     valid bundle and we should return *something*.
func ResolveXccrashpoint(bundlePath string, opts xccrashpointResolveOptions) (xccrashpointResolution, error) {
	abs, err := filepath.Abs(bundlePath)
	if err != nil {
		return xccrashpointResolution{}, fmt.Errorf("resolve bundle path: %w", err)
	}

	filtersDir := filepath.Join(abs, "Filters")
	entries, err := os.ReadDir(filtersDir)
	if err != nil {
		if os.IsNotExist(err) {
			return xccrashpointResolution{}, errNotXccrashpoint
		}
		return xccrashpointResolution{}, fmt.Errorf("read %s: %w", filtersDir, err)
	}

	type filterCandidate struct {
		path    string
		modTime int64
	}
	var candidates []filterCandidate
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasPrefix(name, "Filter_") {
			continue
		}
		if opts.FilterMatch != "" && !strings.Contains(name, opts.FilterMatch) {
			continue
		}
		info, statErr := e.Info()
		if statErr != nil {
			return xccrashpointResolution{}, fmt.Errorf("stat %s: %w", filepath.Join(filtersDir, name), statErr)
		}
		candidates = append(candidates, filterCandidate{
			path:    filepath.Join(filtersDir, name),
			modTime: info.ModTime().UnixNano(),
		})
	}
	if len(candidates) == 0 {
		return xccrashpointResolution{}, errNotXccrashpoint
	}
	sort.SliceStable(candidates, func(i, j int) bool {
		return candidates[i].modTime > candidates[j].modTime
	})

	for _, c := range candidates {
		resolution, found, pickErr := pickCrashInFilter(c.path, opts.PreferLocallySymbolicated)
		if pickErr != nil {
			return xccrashpointResolution{}, pickErr
		}
		if found {
			resolution.BundlePath = abs
			return resolution, nil
		}
	}
	return xccrashpointResolution{}, errNotXccrashpoint
}

// pickCrashInFilter chooses one .crash within a Filter dir. Selection within
// a directory is deterministic (alphabetical) so repeat runs return the
// same file — Xcode bundles sometimes contain multiple .crash files for the
// same incident, and the user shouldn't see different output run-to-run.
//
// (xccrashpointResolution, true, nil) — picked successfully.
// (zero, false, nil)                  — no usable .crash in this Filter; try next.
// (zero, false, err)                  — real I/O error; abort the resolve.
func pickCrashInFilter(filterDir string, preferLocallySymbolicated bool) (xccrashpointResolution, bool, error) {
	logsDir := filepath.Join(filterDir, "Logs")
	if _, err := os.Stat(logsDir); err != nil {
		if os.IsNotExist(err) {
			return xccrashpointResolution{}, false, nil
		}
		return xccrashpointResolution{}, false, fmt.Errorf("stat %s: %w", logsDir, err)
	}

	rawCrashes, err := listCrashFiles(logsDir)
	if err != nil {
		return xccrashpointResolution{}, false, err
	}
	locallySymbolicated, err := listCrashFiles(filepath.Join(logsDir, "LocallySymbolicated"))
	if err != nil {
		return xccrashpointResolution{}, false, err
	}

	primary, fallback := rawCrashes, locallySymbolicated
	if preferLocallySymbolicated {
		primary, fallback = locallySymbolicated, rawCrashes
	}

	if len(primary) > 0 {
		return xccrashpointResolution{FilterDir: filterDir, CrashPath: primary[0]}, true, nil
	}
	if len(fallback) > 0 {
		return xccrashpointResolution{FilterDir: filterDir, CrashPath: fallback[0]}, true, nil
	}
	return xccrashpointResolution{}, false, nil
}

// listCrashFiles returns absolute paths of *.crash files directly inside dir,
// sorted alphabetically. Returns (nil, nil) when dir doesn't exist — a
// missing LocallySymbolicated/ subdirectory isn't an error, just an empty
// result. Real I/O errors (permission denied, etc.) propagate.
func listCrashFiles(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read %s: %w", dir, err)
	}
	var paths []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if !strings.HasSuffix(e.Name(), ".crash") {
			continue
		}
		paths = append(paths, filepath.Join(dir, e.Name()))
	}
	sort.Strings(paths)
	return paths, nil
}
