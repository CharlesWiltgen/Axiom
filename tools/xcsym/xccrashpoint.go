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

// XccrashpointBundleSuffix is the directory suffix that identifies an Xcode
// Organizer crash bundle. Matched case-sensitively because Xcode itself
// emits the lowercase form.
const XccrashpointBundleSuffix = ".xccrashpoint"

// xccrashpointResolveOptions controls how a bundle is resolved to a single
// .crash file inside it. Defaults match the common case: pick the most
// recently modified Filter directory and prefer the raw (un-symbolicated)
// .crash so dSYM verification can use the original UUIDs.
type xccrashpointResolveOptions struct {
	// FilterMatch is a substring matched against the Filter_* directory name.
	// Empty selects all filter dirs and falls back to most-recent-mtime.
	FilterMatch string

	// PreferLocallySymbolicated picks Logs/LocallySymbolicated/*.crash when
	// present. Defaults to false so dSYM verify sees the raw frames; flip
	// when the user just wants Xcode's pre-resolved frames or the raw copy
	// is missing.
	PreferLocallySymbolicated bool
}

// xccrashpointResolution describes which file inside a bundle we resolved to.
// BundlePath is the original .xccrashpoint argument; CrashPath is the .crash
// file the rest of the pipeline should read. Both are absolute when the
// caller passed an absolute bundle path.
type xccrashpointResolution struct {
	BundlePath           string
	FilterDir            string // absolute path of the chosen Filter_* directory
	CrashPath            string // absolute path of the .crash file inside Logs/
	UsedLocallySymbolicated bool   // whether we picked from Logs/LocallySymbolicated/
}

// errNotXccrashpoint signals that the path is a directory but not a bundle
// xcsym knows how to walk. Callers convert this to the structured
// "unsupported_format" reject so agents can route on JSON.
var errNotXccrashpoint = errors.New("directory is not a recognized .xccrashpoint bundle")

// IsXccrashpointPath returns true when path looks like an Xcode crash bundle.
// We deliberately accept any directory whose name ends in .xccrashpoint —
// even one that's missing its inner Filters/ tree — so the caller can emit
// a useful "bundle is empty/corrupt" reject instead of a generic
// "is a directory" error. Walk failures surface at ResolveXccrashpoint time.
func IsXccrashpointPath(path string) bool {
	if !strings.HasSuffix(path, XccrashpointBundleSuffix) {
		return false
	}
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}

// ResolveXccrashpoint walks bundlePath/Filters/*/Logs/ and returns the chosen
// .crash file. Returns errNotXccrashpoint when the bundle is missing the
// expected structure (no Filters/, no Logs/, no .crash files inside Logs/).
//
// Selection algorithm:
//
//  1. Enumerate Filters/Filter_*/. If FilterMatch is set, keep only entries
//     whose directory name contains the substring.
//  2. Sort surviving Filter dirs by modification time, newest first.
//  3. Walk each candidate's Logs/ in order. The first one with a usable
//     .crash file wins. (A bundle with multiple Filter dirs but only the
//     oldest has a .crash is unusual but not impossible — we don't want to
//     reject in that case.)
//  4. PreferLocallySymbolicated picks Logs/LocallySymbolicated/*.crash;
//     otherwise we look at Logs/*.crash directly. If the preferred copy
//     is missing, fall through to the other one rather than fail — the
//     user gave us a valid bundle and we should return *something*.
func ResolveXccrashpoint(bundlePath string, opts xccrashpointResolveOptions) (xccrashpointResolution, error) {
	abs, err := filepath.Abs(bundlePath)
	if err != nil {
		return xccrashpointResolution{}, fmt.Errorf("resolve bundle path: %w", err)
	}

	filtersDir := filepath.Join(abs, "Filters")
	entries, err := os.ReadDir(filtersDir)
	if err != nil {
		// Missing/unreadable Filters/ dir — caller wants a structured reject.
		return xccrashpointResolution{}, errNotXccrashpoint
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
			continue
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
		resolution, found := pickCrashInFilter(c.path, opts.PreferLocallySymbolicated)
		if found {
			resolution.BundlePath = abs
			return resolution, nil
		}
	}
	return xccrashpointResolution{}, errNotXccrashpoint
}

// pickCrashInFilter inspects a single Filter_*/Logs directory and chooses
// one .crash file. Returns (_, false) when neither the preferred nor the
// fallback copy exists. Selection within a directory is deterministic
// (alphabetical) so repeat runs return the same file — Xcode bundles
// sometimes contain multiple .crash files for the same incident, and the
// user shouldn't see different output run-to-run.
func pickCrashInFilter(filterDir string, preferLocallySymbolicated bool) (xccrashpointResolution, bool) {
	logsDir := filepath.Join(filterDir, "Logs")
	if _, err := os.Stat(logsDir); err != nil {
		return xccrashpointResolution{}, false
	}

	rawCrashes, _ := listCrashFiles(logsDir)
	locallySymbolicated, _ := listCrashFiles(filepath.Join(logsDir, "LocallySymbolicated"))

	primary, fallback := rawCrashes, locallySymbolicated
	usedLocally := false
	if preferLocallySymbolicated {
		primary, fallback = locallySymbolicated, rawCrashes
		usedLocally = true
	}

	if len(primary) > 0 {
		return xccrashpointResolution{
			FilterDir:               filterDir,
			CrashPath:               primary[0],
			UsedLocallySymbolicated: usedLocally,
		}, true
	}
	if len(fallback) > 0 {
		return xccrashpointResolution{
			FilterDir:               filterDir,
			CrashPath:               fallback[0],
			UsedLocallySymbolicated: !usedLocally,
		}, true
	}
	return xccrashpointResolution{}, false
}

// listCrashFiles returns absolute paths of *.crash files directly inside dir,
// sorted alphabetically. Subdirectories are not recursed (we look at
// LocallySymbolicated/ explicitly elsewhere). Returns (nil, nil) when dir
// doesn't exist — a missing directory isn't an error, just an empty result.
func listCrashFiles(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, nil
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
