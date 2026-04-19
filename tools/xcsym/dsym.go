package main

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// DiscovererOptions configures dSYM discovery sources.
//
// SkipDefaults suppresses the defaulting behavior that fills ArchivesPaths,
// DerivedDataPaths, DownloadsPaths, and ToolchainPaths from the user's home
// directory / xcode-select. Tests use this to prevent real directories from
// bleeding into fixture-driven test runs.
type DiscovererOptions struct {
	Explicit         string   // --dsym override (wins over everything)
	UserPaths        []string // XCSYM_DSYM_PATHS entries
	ArchivesPaths    []string // defaults to ~/Library/Developer/Xcode/Archives
	DerivedDataPaths []string // defaults to ~/Library/Developer/Xcode/DerivedData
	DownloadsPaths   []string // defaults to ~/Downloads
	ToolchainPaths   []string // defaults to $(xcode-select -p)/Toolchains
	FrameworkRoots   []string // cwd + any user-specified roots (xcframework/Carthage/Pods scan)
	CacheDir         string
	Cache            *Cache
	NegCacheTTL      int64 // seconds; 0 means skip negative cache
	SkipCache        bool
	SkipSpotlight    bool
	SkipDefaults     bool
}

// Discoverer resolves dSYMs by UUID across a fixed fallback chain.
// Sources (in order):
//
//	explicit → cache → Spotlight → archives → DerivedData → frameworks → downloads → toolchain → env
type Discoverer struct {
	opts DiscovererOptions
	mu   sync.Mutex
	mem  map[string]DsymEntry // in-process memoization (uppercase UUID key)
}

// DsymEntry describes a dSYM on disk that matches a given UUID.
type DsymEntry struct {
	UUID      string
	Path      string // path to the .dSYM bundle (or a plain Mach-O for explicit overrides)
	Arch      string // arch slice that matched
	ImageName string // dSYM binary filename inside Contents/Resources/DWARF
	Source    string // explicit | cache | spotlight | archives | deriveddata | downloads | toolchain | env | frameworks
}

// NewDiscoverer returns a Discoverer with defaults filled in (unless SkipDefaults).
func NewDiscoverer(opts DiscovererOptions) *Discoverer {
	if !opts.SkipDefaults {
		if home, err := os.UserHomeDir(); err == nil {
			if len(opts.ArchivesPaths) == 0 {
				opts.ArchivesPaths = []string{filepath.Join(home, "Library", "Developer", "Xcode", "Archives")}
			}
			if len(opts.DerivedDataPaths) == 0 {
				opts.DerivedDataPaths = []string{filepath.Join(home, "Library", "Developer", "Xcode", "DerivedData")}
			}
			if len(opts.DownloadsPaths) == 0 {
				opts.DownloadsPaths = []string{filepath.Join(home, "Downloads")}
			}
		}
	}
	return &Discoverer{opts: opts, mem: make(map[string]DsymEntry)}
}

// NewDiscovererFromEnv is like NewDiscoverer but also reads
// XCSYM_DSYM_PATHS (colon-separated) into UserPaths when opts.UserPaths is empty.
func NewDiscovererFromEnv(opts DiscovererOptions) *Discoverer {
	if len(opts.UserPaths) == 0 {
		if raw := os.Getenv("XCSYM_DSYM_PATHS"); raw != "" {
			for _, p := range strings.Split(raw, ":") {
				p = strings.TrimSpace(p)
				if p != "" {
					opts.UserPaths = append(opts.UserPaths, p)
				}
			}
		}
	}
	return NewDiscoverer(opts)
}

// Find returns a dSYM matching uuid (and arch, when non-empty) or an error.
//
// On a mismatch between requested arch and available slice, Find returns the
// entry with the dSYM's real arch. Callers (VerifyImages) classify that as
// a mismatch rather than a miss.
func (d *Discoverer) Find(ctx context.Context, uuid, arch string) (*DsymEntry, error) {
	uuid = NormalizeUUID(uuid)
	d.mu.Lock()
	if e, ok := d.mem[uuid]; ok {
		d.mu.Unlock()
		return &e, nil
	}
	d.mu.Unlock()

	// 1. Explicit override — bypass every other source.
	if d.opts.Explicit != "" {
		if _, err := os.Stat(d.opts.Explicit); err == nil {
			return d.memo(uuid, DsymEntry{UUID: uuid, Path: d.opts.Explicit, Arch: arch, Source: "explicit"}), nil
		}
	}

	// 2. Persistent cache (fast path across invocations).
	if !d.opts.SkipCache && d.opts.Cache != nil {
		if d.opts.Cache.IsNegative(uuid) {
			return nil, fmt.Errorf("dSYM not found for UUID %s (negative cache)", uuid)
		}
		if ce, ok := d.opts.Cache.Get(uuid); ok {
			return d.memo(uuid, DsymEntry{
				UUID: ce.UUID, Path: ce.Path, Arch: ce.Arch, ImageName: ce.ImageName, Source: "cache",
			}), nil
		}
	}

	// 3-9. Source fallback chain.
	sources := []func(context.Context, string, string) *DsymEntry{
		d.findViaSpotlight,
		d.findInArchives,
		d.findInDerivedData,
		d.findInFrameworks,
		d.findInDownloads,
		d.findInToolchain,
		d.findInEnvPaths,
	}
	for _, src := range sources {
		if entry := src(ctx, uuid, arch); entry != nil {
			d.cachePositive(*entry)
			return d.memo(uuid, *entry), nil
		}
	}

	d.cacheNegative(uuid)
	return nil, fmt.Errorf("dSYM not found for UUID %s", uuid)
}

func (d *Discoverer) memo(uuid string, e DsymEntry) *DsymEntry {
	d.mu.Lock()
	d.mem[uuid] = e
	d.mu.Unlock()
	return &e
}

func (d *Discoverer) cachePositive(e DsymEntry) {
	if d.opts.SkipCache || d.opts.Cache == nil {
		return
	}
	info, err := os.Stat(e.Path)
	if err != nil {
		return
	}
	_ = d.opts.Cache.Put(CacheEntry{
		UUID: e.UUID, Path: e.Path, Arch: e.Arch, ImageName: e.ImageName, MTime: info.ModTime().Unix(),
	})
}

func (d *Discoverer) cacheNegative(uuid string) {
	if d.opts.SkipCache || d.opts.Cache == nil || d.opts.NegCacheTTL <= 0 {
		return
	}
	_ = d.opts.Cache.PutNegativeSeconds(uuid, d.opts.NegCacheTTL)
}

// findViaSpotlight queries mdfind for dSYMs indexed with the given UUID.
// Spotlight is the fastest source when the index is warm.
func (d *Discoverer) findViaSpotlight(ctx context.Context, uuid, arch string) *DsymEntry {
	if d.opts.SkipSpotlight {
		return nil
	}
	// Query format: com_apple_xcode_dsym_uuids == "<UUID>".
	res, err := ExecRun(ctx, 0, "mdfind", fmt.Sprintf(`com_apple_xcode_dsym_uuids == %q`, uuid))
	if err != nil {
		return nil
	}
	for _, path := range strings.Split(strings.TrimSpace(string(res.Stdout)), "\n") {
		path = strings.TrimSpace(path)
		if path == "" {
			continue
		}
		if entry := matchDsymBundle(ctx, path, uuid, arch); entry != nil {
			entry.Source = "spotlight"
			return entry
		}
	}
	return nil
}

// findInArchives walks ~/Library/Developer/Xcode/Archives (and user overrides).
func (d *Discoverer) findInArchives(ctx context.Context, uuid, arch string) *DsymEntry {
	return walkRoots(ctx, d.opts.ArchivesPaths, uuid, arch, "archives")
}

// findInDerivedData walks ~/Library/Developer/Xcode/DerivedData.
func (d *Discoverer) findInDerivedData(ctx context.Context, uuid, arch string) *DsymEntry {
	return walkRoots(ctx, d.opts.DerivedDataPaths, uuid, arch, "deriveddata")
}

// findInDownloads walks ~/Downloads (shallow). Users often drop App Store
// Connect "dSYMs.zip" extractions here.
func (d *Discoverer) findInDownloads(ctx context.Context, uuid, arch string) *DsymEntry {
	return walkRoots(ctx, d.opts.DownloadsPaths, uuid, arch, "downloads")
}

// findInToolchain walks $(xcode-select -p)/Toolchains for system framework dSYMs.
func (d *Discoverer) findInToolchain(ctx context.Context, uuid, arch string) *DsymEntry {
	paths := d.opts.ToolchainPaths
	if len(paths) == 0 && !d.opts.SkipDefaults {
		if res, err := ExecRun(ctx, 0, "xcode-select", "-p"); err == nil {
			base := strings.TrimSpace(string(res.Stdout))
			if base != "" {
				paths = []string{filepath.Join(base, "Toolchains")}
			}
		}
	}
	return walkRoots(ctx, paths, uuid, arch, "toolchain")
}

// findInFrameworks scans the current working directory (+ any user-provided
// framework roots) for *.xcframework, Carthage/Build, and Pods — common
// locations for third-party dSYMs inside an app project checkout.
func (d *Discoverer) findInFrameworks(ctx context.Context, uuid, arch string) *DsymEntry {
	roots := append([]string{}, d.opts.FrameworkRoots...)
	if !d.opts.SkipDefaults {
		if cwd, err := os.Getwd(); err == nil {
			roots = append(roots, cwd)
		}
	}
	return walkRoots(ctx, roots, uuid, arch, "frameworks")
}

// findInEnvPaths walks XCSYM_DSYM_PATHS entries.
func (d *Discoverer) findInEnvPaths(ctx context.Context, uuid, arch string) *DsymEntry {
	return walkRoots(ctx, d.opts.UserPaths, uuid, arch, "env")
}

func walkRoots(ctx context.Context, roots []string, uuid, arch, source string) *DsymEntry {
	for _, root := range roots {
		if root == "" {
			continue
		}
		if _, err := os.Stat(root); err != nil {
			continue
		}
		if entry := walkForDsymUUID(ctx, root, uuid, arch); entry != nil {
			entry.Source = source
			return entry
		}
	}
	return nil
}

// walkForDsymUUID walks root looking for any *.dSYM whose DWARF binary
// contains the requested UUID. When arch is provided, prefers the exact
// arch slice; if none of the slices match, still returns the entry with
// its own arch so VerifyImages can classify as mismatch rather than miss.
func walkForDsymUUID(ctx context.Context, root, uuid, arch string) *DsymEntry {
	var match *DsymEntry
	var mismatch *DsymEntry

	filepath.WalkDir(root, func(path string, dir fs.DirEntry, err error) error {
		if err != nil || match != nil || ctx.Err() != nil {
			return filepath.SkipDir
		}
		if !dir.IsDir() {
			return nil
		}
		if !strings.HasSuffix(path, ".dSYM") {
			return nil
		}
		if entry := matchDsymBundle(ctx, path, uuid, arch); entry != nil {
			if arch == "" || entry.Arch == arch {
				match = entry
				return filepath.SkipAll
			}
			if mismatch == nil {
				mismatch = entry // remember, but keep looking for an exact arch match
			}
		}
		return filepath.SkipDir
	})
	if match != nil {
		return match
	}
	return mismatch
}

// matchDsymBundle returns a DsymEntry when the dSYM at bundlePath contains
// the requested UUID. Arch preference: exact match wins; otherwise any slice
// with the right UUID is returned (caller classifies as mismatch).
func matchDsymBundle(ctx context.Context, bundlePath, uuid, arch string) *DsymEntry {
	dwarf := filepath.Join(bundlePath, "Contents", "Resources", "DWARF")
	entries, err := os.ReadDir(dwarf)
	if err != nil {
		return nil
	}
	var fallback *DsymEntry
	for _, e := range entries {
		bin := filepath.Join(dwarf, e.Name())
		uuids, err := ReadUUIDs(ctx, bin)
		if err != nil {
			continue
		}
		for _, u := range uuids {
			if u.UUID != uuid {
				continue
			}
			entry := &DsymEntry{UUID: uuid, Path: bundlePath, Arch: u.Arch, ImageName: e.Name()}
			if arch == "" || u.Arch == arch {
				return entry
			}
			if fallback == nil {
				fallback = entry
			}
		}
	}
	return fallback
}
