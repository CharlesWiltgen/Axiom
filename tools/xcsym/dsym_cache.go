package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"
)

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
// are treated as empty caches. Callers should always pair NewCache with a
// valid directory — pass DefaultCacheDir() for the standard ~/Library path.
func NewCache(dir string) *Cache {
	c := &Cache{dir: dir, pos: make(map[string]CacheEntry), neg: make(map[string]int64)}
	c.load()
	return c
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

func (c *Cache) path() string    { return filepath.Join(c.dir, "uuid-index.json") }
func (c *Cache) negPath() string { return filepath.Join(c.dir, "negative.json") }

func (c *Cache) load() {
	if data, err := os.ReadFile(c.path()); err == nil {
		var entries []CacheEntry
		if json.Unmarshal(data, &entries) == nil {
			for _, e := range entries {
				c.pos[NormalizeUUID(e.UUID)] = e
			}
		}
	}
	if data, err := os.ReadFile(c.negPath()); err == nil {
		var entries []negativeEntry
		if json.Unmarshal(data, &entries) == nil {
			now := time.Now().Unix()
			for _, e := range entries {
				if e.Expires > now {
					c.neg[NormalizeUUID(e.UUID)] = e.Expires
				}
			}
		}
	}
}

// Put stores a positive cache entry. The UUID is normalized (uppercase with dashes)
// so later lookups with either case hit the same row.
func (c *Cache) Put(e CacheEntry) error {
	key := NormalizeUUID(e.UUID)
	e.UUID = key
	c.mu.Lock()
	c.pos[key] = e
	entries := make([]CacheEntry, 0, len(c.pos))
	for _, v := range c.pos {
		entries = append(entries, v)
	}
	c.mu.Unlock()
	return writeAtomic(c.dir, c.path(), entries)
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
		c.mu.Lock()
		delete(c.pos, key)
		entries := make([]CacheEntry, 0, len(c.pos))
		for _, v := range c.pos {
			entries = append(entries, v)
		}
		c.mu.Unlock()
		_ = writeAtomic(c.dir, c.path(), entries)
		return CacheEntry{}, false
	}
	return e, true
}

// PutNegative records a "UUID was not found anywhere" result with a TTL.
func (c *Cache) PutNegative(uuid string, ttl time.Duration) error {
	key := NormalizeUUID(uuid)
	exp := time.Now().Add(ttl).Unix()
	c.mu.Lock()
	c.neg[key] = exp
	entries := make([]negativeEntry, 0, len(c.neg))
	for k, v := range c.neg {
		entries = append(entries, negativeEntry{UUID: k, Expires: v})
	}
	c.mu.Unlock()
	return writeAtomic(c.dir, c.negPath(), entries)
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
