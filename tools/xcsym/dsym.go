package main

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// ErrNotFound signals exhaustive discovery without a match. Callers that want
// to distinguish "dSYM absent" from "tool failure / timeout" use errors.Is.
var ErrNotFound = errors.New("dSYM not found")

// DiscovererOptions configures dSYM discovery sources.
//
// SkipDefaults suppresses the defaulting behavior that fills ArchivesPaths,
// DerivedDataPaths, DownloadsPaths, and ToolchainPaths from the user's home
// directory / xcode-select. Tests use this to prevent real directories from
// bleeding into fixture-driven test runs.
type DiscovererOptions struct {
	// Explicit overrides every source for every UUID. Convenient for `verify`,
	// but wrong for `crash` (which wants the override to apply to the main
	// binary only). Phase 5 uses ExplicitByUUID for that case.
	Explicit string
	// ExplicitByUUID maps a specific UUID to a dSYM/binary path. Takes
	// precedence over Explicit and the rest of the chain, but only when the
	// requested UUID matches. UUIDs are normalized (uppercase with dashes).
	ExplicitByUUID map[string]string
	UserPaths      []string // XCSYM_DSYM_PATHS entries
	ArchivesPaths  []string // defaults to ~/Library/Developer/Xcode/Archives
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
//	ExplicitByUUID → Explicit → cache → Spotlight → archives → DerivedData → frameworks → downloads → toolchain → env
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
	// Normalize any caller-provided ExplicitByUUID keys so lookups match
	// what NormalizeUUID produces downstream.
	if len(opts.ExplicitByUUID) > 0 {
		normalized := make(map[string]string, len(opts.ExplicitByUUID))
		for k, v := range opts.ExplicitByUUID {
			normalized[NormalizeUUID(k)] = v
		}
		opts.ExplicitByUUID = normalized
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
// Error semantics:
//   - ErrNotFound (wrapped): exhaustive search found nothing. Caller should
//     classify the image as Missing.
//   - Any other error: a source's tool (mdfind, dwarfdump) failed or timed
//     out. Caller should surface this rather than treat it as a miss.
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

	// 0. Per-UUID explicit — highest precedence, narrowest scope.
	if path, ok := d.opts.ExplicitByUUID[uuid]; ok {
		if _, err := os.Stat(path); err == nil {
			return d.memo(uuid, DsymEntry{UUID: uuid, Path: path, Arch: arch, Source: "explicit"}), nil
		}
	}

	// 1. Global explicit override.
	if d.opts.Explicit != "" {
		if _, err := os.Stat(d.opts.Explicit); err == nil {
			return d.memo(uuid, DsymEntry{UUID: uuid, Path: d.opts.Explicit, Arch: arch, Source: "explicit"}), nil
		}
	}

	// 2. Persistent cache (fast path across invocations).
	if !d.opts.SkipCache && d.opts.Cache != nil {
		if d.opts.Cache.IsNegative(uuid) {
			return nil, fmt.Errorf("%w for UUID %s (negative cache)", ErrNotFound, uuid)
		}
		if ce, ok := d.opts.Cache.Get(uuid); ok {
			return d.memo(uuid, DsymEntry{
				UUID: ce.UUID, Path: ce.Path, Arch: ce.Arch, ImageName: ce.ImageName, Source: "cache",
			}), nil
		}
	}

	// 3-9. Source fallback chain. A non-nil error from any source (timeout,
	// ctx cancel) aborts the chain; a nil error with nil entry just means
	// "not found here, try next source".
	sources := []func(context.Context, string, string) (*DsymEntry, error){
		d.findViaSpotlight,
		d.findInArchives,
		d.findInDerivedData,
		d.findInFrameworks,
		d.findInDownloads,
		d.findInToolchain,
		d.findInEnvPaths,
	}
	for _, src := range sources {
		entry, err := src(ctx, uuid, arch)
		if err != nil {
			return nil, err
		}
		if entry != nil {
			d.cachePositive(*entry)
			return d.memo(uuid, *entry), nil
		}
	}

	d.cacheNegative(uuid)
	return nil, fmt.Errorf("%w: UUID %s", ErrNotFound, uuid)
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

// isHardToolError decides whether a source's tool error should abort the whole
// Find chain (true: timeout or ctx cancellation) or just skip to the next
// source (false: tool missing, binary unreadable, etc.).
func isHardToolError(ctx context.Context, err error) bool {
	if err == nil {
		return false
	}
	if IsTimeoutError(err) {
		return true
	}
	return ctx.Err() != nil
}

// findViaSpotlight queries mdfind for dSYMs indexed with the given UUID.
// Spotlight is the fastest source when the index is warm.
func (d *Discoverer) findViaSpotlight(ctx context.Context, uuid, arch string) (*DsymEntry, error) {
	if d.opts.SkipSpotlight {
		return nil, nil
	}
	res, err := ExecRun(ctx, 0, "mdfind", fmt.Sprintf(`com_apple_xcode_dsym_uuids == %q`, uuid))
	if err != nil {
		if isHardToolError(ctx, err) {
			return nil, err
		}
		return nil, nil
	}
	for _, path := range strings.Split(strings.TrimSpace(string(res.Stdout)), "\n") {
		path = strings.TrimSpace(path)
		if path == "" {
			continue
		}
		entry, err := matchDsymBundle(ctx, path, uuid, arch)
		if err != nil {
			return nil, err
		}
		if entry != nil {
			entry.Source = "spotlight"
			return entry, nil
		}
	}
	return nil, nil
}

// findInArchives walks ~/Library/Developer/Xcode/Archives (and user overrides).
func (d *Discoverer) findInArchives(ctx context.Context, uuid, arch string) (*DsymEntry, error) {
	return walkRoots(ctx, d.opts.ArchivesPaths, uuid, arch, "archives")
}

// findInDerivedData walks ~/Library/Developer/Xcode/DerivedData.
func (d *Discoverer) findInDerivedData(ctx context.Context, uuid, arch string) (*DsymEntry, error) {
	return walkRoots(ctx, d.opts.DerivedDataPaths, uuid, arch, "deriveddata")
}

// findInDownloads walks ~/Downloads (shallow). Users often drop App Store
// Connect "dSYMs.zip" extractions here.
func (d *Discoverer) findInDownloads(ctx context.Context, uuid, arch string) (*DsymEntry, error) {
	return walkRoots(ctx, d.opts.DownloadsPaths, uuid, arch, "downloads")
}

// findInToolchain walks $(xcode-select -p)/Toolchains for system framework dSYMs.
func (d *Discoverer) findInToolchain(ctx context.Context, uuid, arch string) (*DsymEntry, error) {
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
//
// The walk is bounded by DefaultFrameworkScanTimeout so an unrelated monorepo
// cwd can't stall dSYM discovery. A child-ctx deadline is swallowed as a miss
// (continue the Find chain); parent-ctx cancellation still propagates.
func (d *Discoverer) findInFrameworks(ctx context.Context, uuid, arch string) (*DsymEntry, error) {
	roots := append([]string{}, d.opts.FrameworkRoots...)
	if !d.opts.SkipDefaults {
		if cwd, err := os.Getwd(); err == nil {
			roots = append(roots, cwd)
		}
	}
	if len(roots) == 0 {
		return nil, nil
	}
	scanCtx, cancel := context.WithTimeout(ctx, DefaultFrameworkScanTimeout())
	defer cancel()
	entry, err := walkRoots(scanCtx, roots, uuid, arch, "frameworks")
	if err != nil {
		// Parent-ctx cancellation or other hard errors propagate. A child-ctx
		// deadline (parent still alive) means "exhausted our budget here" —
		// let the Find chain try the next source.
		if ctx.Err() == nil && (errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled)) {
			return nil, nil
		}
		return nil, err
	}
	return entry, nil
}

// findInEnvPaths walks XCSYM_DSYM_PATHS entries.
func (d *Discoverer) findInEnvPaths(ctx context.Context, uuid, arch string) (*DsymEntry, error) {
	return walkRoots(ctx, d.opts.UserPaths, uuid, arch, "env")
}

// walkForDsymUUIDFn is walkForDsymUUID behind a function-typed var so tests
// can substitute a stub that simulates cross-root match/mismatch outcomes
// without having to synthesize real dSYM bundles (the UUID/arch ordering bug
// that walkRoots guards against can't be reproduced with real fixtures —
// slice UUIDs are content-hashes, so "same UUID, different arch across two
// dSYMs" is physically impossible in real dwarfdump output).
var walkForDsymUUIDFn = walkForDsymUUID

// walkRoots walks the given roots in order, returning the best entry found.
// An exact-arch match in any root wins immediately and short-circuits the
// loop. If every root only yields mismatches (UUID matches, arch differs),
// the first mismatch is returned — ordered by root list, not by whichever
// root we happened to hit first. This protects against a root with a
// wrong-arch dSYM masking a later root with the correct arch slice.
//
// A non-nil error aborts the source (never a per-root error that would make
// a later root unreachable — walkForDsymUUID returns errors only for ctx
// cancellation and tool timeouts, both of which correctly terminate the
// whole Find chain).
func walkRoots(ctx context.Context, roots []string, uuid, arch, source string) (*DsymEntry, error) {
	var firstMismatch *DsymEntry
	for _, root := range roots {
		if root == "" {
			continue
		}
		if _, err := os.Stat(root); err != nil {
			continue
		}
		entry, err := walkForDsymUUIDFn(ctx, root, uuid, arch)
		if err != nil {
			return nil, err
		}
		if entry == nil {
			continue
		}
		if arch == "" || entry.Arch == arch {
			entry.Source = source
			return entry, nil
		}
		if firstMismatch == nil {
			firstMismatch = entry
			firstMismatch.Source = source
		}
	}
	return firstMismatch, nil
}

// walkForDsymUUID walks root looking for any *.dSYM whose DWARF binary
// contains the requested UUID. When arch is provided, prefers the exact
// arch slice; if only a different slice exists, still returns the entry so
// VerifyImages can classify as mismatch rather than miss.
//
// Returns an error only for ctx cancellation or tool timeouts — per-dSYM
// read failures are swallowed so a malformed bundle can't abort the walk.
func walkForDsymUUID(ctx context.Context, root, uuid, arch string) (*DsymEntry, error) {
	var match *DsymEntry
	var mismatch *DsymEntry
	var walkErr error

	_ = filepath.WalkDir(root, func(path string, dir fs.DirEntry, err error) error {
		if walkErr != nil || match != nil {
			return filepath.SkipAll
		}
		if ctx.Err() != nil {
			walkErr = ctx.Err()
			return filepath.SkipAll
		}
		if err != nil {
			// Per-dir error (permission denied on one subdir) shouldn't abort
			// the whole walk — just skip this subtree.
			return filepath.SkipDir
		}
		if !dir.IsDir() {
			return nil
		}
		if !strings.HasSuffix(path, ".dSYM") {
			return nil
		}
		entry, mErr := matchDsymBundle(ctx, path, uuid, arch)
		if mErr != nil {
			walkErr = mErr
			return filepath.SkipAll
		}
		if entry == nil {
			return filepath.SkipDir
		}
		if arch == "" || entry.Arch == arch {
			match = entry
			return filepath.SkipAll
		}
		if mismatch == nil {
			mismatch = entry
		}
		return filepath.SkipDir
	})
	if walkErr != nil {
		return nil, walkErr
	}
	if match != nil {
		return match, nil
	}
	return mismatch, nil
}

// matchDsymBundle returns a DsymEntry when the dSYM at bundlePath contains
// the requested UUID. Arch preference: exact match wins; otherwise any slice
// with the right UUID is returned (caller classifies as mismatch).
//
// A malformed or unreadable bundle returns (nil, nil) — caller should move
// on. Only ctx cancellation / tool timeouts propagate.
func matchDsymBundle(ctx context.Context, bundlePath, uuid, arch string) (*DsymEntry, error) {
	dwarf := filepath.Join(bundlePath, "Contents", "Resources", "DWARF")
	entries, err := os.ReadDir(dwarf)
	if err != nil {
		return nil, nil
	}
	var fallback *DsymEntry
	for _, e := range entries {
		bin := filepath.Join(dwarf, e.Name())
		uuids, err := ReadUUIDs(ctx, bin)
		if err != nil {
			if isHardToolError(ctx, err) {
				return nil, err
			}
			continue
		}
		for _, u := range uuids {
			if u.UUID != uuid {
				continue
			}
			entry := &DsymEntry{UUID: uuid, Path: bundlePath, Arch: u.Arch, ImageName: e.Name()}
			if arch == "" || u.Arch == arch {
				return entry, nil
			}
			if fallback == nil {
				fallback = entry
			}
		}
	}
	return fallback, nil
}
