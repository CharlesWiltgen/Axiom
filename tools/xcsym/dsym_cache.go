package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// cacheSchemaVersion is the on-disk envelope version. Bump when a CacheEntry
// or negativeEntry field addition would cause zero-valued defaults to be
// silently wrong; readers on a different version drop the cache rather than
// deserialize ambiguous data. One free rebuild miss is cheaper than bad data.
const cacheSchemaVersion = 1

// CacheEntry is a persistent UUID→dSYM mapping stored between invocations.
type CacheEntry struct {
	UUID      string `json:"uuid"`
	Path      string `json:"path"`
	Arch      string `json:"arch"`
	ImageName string `json:"image_name"`
	MTime     int64  `json:"mtime"`
}

type negativeEntry struct {
	UUID    string `json:"uuid"`
	Expires int64  `json:"expires"`
}

// cacheFileV1 is the versioned on-disk envelope for uuid-index.json.
type cacheFileV1 struct {
	Version int          `json:"version"`
	Entries []CacheEntry `json:"entries"`
}

// negativeFileV1 is the versioned on-disk envelope for negative.json.
type negativeFileV1 struct {
	Version int             `json:"version"`
	Entries []negativeEntry `json:"entries"`
}

// Cache stores positive and negative UUID lookups across xcsym invocations.
// Positive entries are invalidated on mtime mismatch or missing path.
// Negative entries expire per their TTL (XCSYM_NEG_CACHE_TTL, default 3600s).
type Cache struct {
	dir string
	mu  sync.Mutex
	pos map[string]CacheEntry
	neg map[string]int64
}

// NewCache loads any existing cache files in dir. Missing / unreadable files
// (including files written by a different schema version) are treated as
// empty caches — the next successful lookup rebuilds them. Callers should
// always pair NewCache with a valid directory — pass DefaultCacheDir() for
// the standard ~/Library path.
//
// NewCache also sweeps stale writeAtomic temp files (.xcsym-* older than
// staleTempFileMaxAge) to prevent accumulation when xcsym processes die
// between CreateTemp and Rename.
func NewCache(dir string) *Cache {
	c := &Cache{dir: dir, pos: make(map[string]CacheEntry), neg: make(map[string]int64)}
	sweepStaleTempFiles(dir, staleTempFileMaxAge)
	c.load()
	return c
}

// staleTempFileMaxAge is how old a writeAtomic temp file has to be before
// NewCache considers it orphaned. An hour is comfortably longer than any
// legitimate xcsym invocation and shorter than a user-visible quota drift.
const staleTempFileMaxAge = time.Hour

// sweepStaleTempFiles removes ".xcsym-*" files in dir older than maxAge.
// Best-effort: a missing dir or a permission error just skips the sweep.
// Exported at the package level so tests can drive it with a custom age.
func sweepStaleTempFiles(dir string, maxAge time.Duration) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	cutoff := time.Now().Add(-maxAge)
	for _, e := range entries {
		if e.IsDir() || !strings.HasPrefix(e.Name(), ".xcsym-") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			_ = os.Remove(filepath.Join(dir, e.Name()))
		}
	}
}

// DefaultCacheDir returns ~/Library/Caches/xcsym (falls back to /tmp/xcsym on failure).
func DefaultCacheDir() string {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return filepath.Join(os.TempDir(), "xcsym")
	}
	return filepath.Join(home, "Library", "Caches", "xcsym")
}

// DefaultNegCacheTTLSeconds honors XCSYM_NEG_CACHE_TTL. Default 3600s.
// A value of 0 disables negative caching.
func DefaultNegCacheTTLSeconds() int64 {
	if v := os.Getenv("XCSYM_NEG_CACHE_TTL"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return 3600
}

func (c *Cache) path() string     { return filepath.Join(c.dir, "uuid-index.json") }
func (c *Cache) negPath() string  { return filepath.Join(c.dir, "negative.json") }
func (c *Cache) lockPath() string { return filepath.Join(c.dir, ".lock") }

// withCacheLock runs fn with exclusive advisory flock on the shared sidecar
// file. Serializes cross-process RMW so the pattern
//
//	load → mutate → atomic-rename-write
//
// can't lose entries: on macOS, flock is per-open-file-description, so two
// xcsym processes racing on the same .lock each hold a distinct description
// and one blocks until the other releases. In-process callers further
// serialize via c.mu inside the closure.
//
// Best-effort by design: if the lock dir can't be created or the lock file
// can't be opened (sandboxed filesystem, out of inodes, etc.) we run fn
// unlocked rather than refuse the write. A cache is a cache — degrading
// to "possibly stomp on a peer's write" is better than failing the lookup
// chain. Tests cover the locked path; real deployments hit it by default.
func (c *Cache) withCacheLock(fn func() error) error {
	if err := os.MkdirAll(c.dir, 0o755); err != nil {
		return fn()
	}
	lf, err := os.OpenFile(c.lockPath(), os.O_CREATE|os.O_RDWR, 0o644)
	if err != nil {
		return fn()
	}
	defer lf.Close()
	if err := syscall.Flock(int(lf.Fd()), syscall.LOCK_EX); err != nil {
		return fn()
	}
	defer syscall.Flock(int(lf.Fd()), syscall.LOCK_UN)
	return fn()
}

// rewritePositiveUnderLock re-reads the positive cache from disk (picking up
// entries another xcsym process wrote since NewCache ran), applies the
// caller's mutation to c.pos, and writes the merged state atomically. The
// flock + re-read loop is what prevents the RMW lost-update bug this method
// exists to fix.
func (c *Cache) rewritePositiveUnderLock(mutate func()) error {
	return c.withCacheLock(func() error {
		c.mu.Lock()
		defer c.mu.Unlock()
		if data, err := os.ReadFile(c.path()); err == nil {
			var env cacheFileV1
			if json.Unmarshal(data, &env) == nil && env.Version == cacheSchemaVersion {
				c.pos = make(map[string]CacheEntry, len(env.Entries))
				for _, de := range env.Entries {
					c.pos[NormalizeUUID(de.UUID)] = de
				}
			}
		}
		mutate()
		entries := make([]CacheEntry, 0, len(c.pos))
		for _, v := range c.pos {
			entries = append(entries, v)
		}
		return writeAtomic(c.dir, c.path(), cacheFileV1{Version: cacheSchemaVersion, Entries: entries})
	})
}

// rewriteNegativeUnderLock is the negative-cache counterpart of
// rewritePositiveUnderLock. Re-reads disk state (dropping already-expired
// entries), applies the mutation, writes back.
func (c *Cache) rewriteNegativeUnderLock(mutate func()) error {
	return c.withCacheLock(func() error {
		c.mu.Lock()
		defer c.mu.Unlock()
		if data, err := os.ReadFile(c.negPath()); err == nil {
			var env negativeFileV1
			if json.Unmarshal(data, &env) == nil && env.Version == cacheSchemaVersion {
				now := time.Now().Unix()
				c.neg = make(map[string]int64, len(env.Entries))
				for _, ne := range env.Entries {
					if ne.Expires > now {
						c.neg[NormalizeUUID(ne.UUID)] = ne.Expires
					}
				}
			}
		}
		mutate()
		entries := make([]negativeEntry, 0, len(c.neg))
		for k, v := range c.neg {
			entries = append(entries, negativeEntry{UUID: k, Expires: v})
		}
		return writeAtomic(c.dir, c.negPath(), negativeFileV1{Version: cacheSchemaVersion, Entries: entries})
	})
}

func (c *Cache) load() {
	// A parse failure — including an old bare-array cache written by a
	// pre-versioned build — leaves the map empty and the cache is silently
	// rebuilt on the next Find() miss. A version-field mismatch is treated
	// the same way: the invariant is that we never load data under a
	// schema we don't fully understand.
	if data, err := os.ReadFile(c.path()); err == nil {
		var env cacheFileV1
		if json.Unmarshal(data, &env) == nil && env.Version == cacheSchemaVersion {
			for _, e := range env.Entries {
				c.pos[NormalizeUUID(e.UUID)] = e
			}
		}
	}
	if data, err := os.ReadFile(c.negPath()); err == nil {
		var env negativeFileV1
		if json.Unmarshal(data, &env) == nil && env.Version == cacheSchemaVersion {
			now := time.Now().Unix()
			for _, e := range env.Entries {
				if e.Expires > now {
					c.neg[NormalizeUUID(e.UUID)] = e.Expires
				}
			}
		}
	}
}

// Put stores a positive cache entry. The UUID is normalized (uppercase with dashes)
// so later lookups with either case hit the same row. Run under a shared
// advisory flock so a concurrent xcsym process can't stomp on this write.
func (c *Cache) Put(e CacheEntry) error {
	key := NormalizeUUID(e.UUID)
	e.UUID = key
	return c.rewritePositiveUnderLock(func() {
		c.pos[key] = e
	})
}

// Get returns a cache hit if the stored path still exists at the original mtime.
// Stale entries are evicted on read so the next Find() re-scans sources.
func (c *Cache) Get(uuid string) (CacheEntry, bool) {
	key := NormalizeUUID(uuid)
	c.mu.Lock()
	e, ok := c.pos[key]
	c.mu.Unlock()
	if !ok {
		return CacheEntry{}, false
	}
	info, err := os.Stat(e.Path)
	if err != nil || info.ModTime().Unix() != e.MTime {
		_ = c.rewritePositiveUnderLock(func() {
			// Re-check under the lock against the now-fresh disk state.
			// A peer xcsym process may have refreshed this entry in the
			// window between our initial stat and acquiring the flock —
			// deleting an entry that's actually fresh on disk would cost
			// the next Find() a full Spotlight/Archives re-scan.
			if de, ok := c.pos[key]; ok {
				if st, sErr := os.Stat(de.Path); sErr == nil && st.ModTime().Unix() == de.MTime {
					return
				}
			}
			delete(c.pos, key)
		})
		return CacheEntry{}, false
	}
	return e, true
}

// PutNegative records a "UUID was not found anywhere" result with a TTL.
// Run under the shared advisory flock to preserve peers' negative entries.
func (c *Cache) PutNegative(uuid string, ttl time.Duration) error {
	key := NormalizeUUID(uuid)
	exp := time.Now().Add(ttl).Unix()
	return c.rewriteNegativeUnderLock(func() {
		c.neg[key] = exp
	})
}

// PutNegativeSeconds is a convenience for integer-seconds TTLs (env-driven).
func (c *Cache) PutNegativeSeconds(uuid string, seconds int64) error {
	return c.PutNegative(uuid, time.Duration(seconds)*time.Second)
}

// IsNegative returns true when we previously recorded a negative miss for uuid
// whose TTL hasn't elapsed.
func (c *Cache) IsNegative(uuid string) bool {
	key := NormalizeUUID(uuid)
	c.mu.Lock()
	exp, ok := c.neg[key]
	c.mu.Unlock()
	return ok && exp > time.Now().Unix()
}

// writeAtomic writes v as JSON to path via a temp-file + rename, ensuring
// readers never see a partially written file.
func writeAtomic(dir, path string, v any) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".xcsym-")
	if err != nil {
		return err
	}
	enc := json.NewEncoder(tmp)
	enc.SetIndent("", "  ")
	if err := enc.Encode(v); err != nil {
		tmp.Close()
		os.Remove(tmp.Name())
		return err
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmp.Name())
		return err
	}
	return os.Rename(tmp.Name(), path)
}
