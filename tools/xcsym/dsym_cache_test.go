package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func TestCache_WriteReadRoundTrip(t *testing.T) {
	dir := t.TempDir()
	tmpFile := filepath.Join(dir, "dsym-binary")
	if err := os.WriteFile(tmpFile, []byte("v1"), 0o644); err != nil {
		t.Fatal(err)
	}
	info, _ := os.Stat(tmpFile)

	c := NewCache(dir)
	e := CacheEntry{UUID: "ABCD", Path: tmpFile, Arch: "arm64", ImageName: "ls", MTime: info.ModTime().Unix()}
	if err := c.Put(e); err != nil {
		t.Fatal(err)
	}
	got, ok := c.Get("ABCD")
	if !ok {
		t.Fatal("expected cache hit")
	}
	if got.Path != tmpFile {
		t.Errorf("path = %q, want %q", got.Path, tmpFile)
	}
	if got.Arch != "arm64" {
		t.Errorf("arch = %q, want arm64", got.Arch)
	}
}

func TestCache_PersistsAcrossInstances(t *testing.T) {
	dir := t.TempDir()
	tmpFile := filepath.Join(dir, "dsym-binary")
	if err := os.WriteFile(tmpFile, []byte("v1"), 0o644); err != nil {
		t.Fatal(err)
	}
	info, _ := os.Stat(tmpFile)

	c1 := NewCache(dir)
	_ = c1.Put(CacheEntry{UUID: "PERSIST", Path: tmpFile, MTime: info.ModTime().Unix()})

	c2 := NewCache(dir)
	if _, ok := c2.Get("PERSIST"); !ok {
		t.Fatal("expected new cache instance to load PERSIST entry from disk")
	}
}

func TestCache_InvalidatesOnMTimeMismatch(t *testing.T) {
	dir := t.TempDir()
	tmpFile := filepath.Join(dir, "fake.dsym-binary")
	if err := os.WriteFile(tmpFile, []byte("v1"), 0o644); err != nil {
		t.Fatal(err)
	}
	info, _ := os.Stat(tmpFile)

	c := NewCache(t.TempDir())
	_ = c.Put(CacheEntry{UUID: "XYZ", Path: tmpFile, MTime: info.ModTime().Unix()})

	later := time.Now().Add(1 * time.Hour)
	if err := os.Chtimes(tmpFile, later, later); err != nil {
		t.Fatal(err)
	}

	if _, ok := c.Get("XYZ"); ok {
		t.Error("expected cache miss after mtime change")
	}
}

func TestCache_InvalidatesWhenFileDeleted(t *testing.T) {
	dir := t.TempDir()
	tmpFile := filepath.Join(dir, "fake.dsym-binary")
	_ = os.WriteFile(tmpFile, []byte("v1"), 0o644)
	info, _ := os.Stat(tmpFile)

	c := NewCache(t.TempDir())
	_ = c.Put(CacheEntry{UUID: "GONE", Path: tmpFile, MTime: info.ModTime().Unix()})

	_ = os.Remove(tmpFile)
	if _, ok := c.Get("GONE"); ok {
		t.Error("expected cache miss after file deletion")
	}
}

func TestCache_NegativeEntry(t *testing.T) {
	dir := t.TempDir()
	c := NewCache(dir)
	if err := c.PutNegative("NOT-FOUND", 10*time.Second); err != nil {
		t.Fatal(err)
	}
	if !c.IsNegative("NOT-FOUND") {
		t.Error("expected negative hit")
	}
}

func TestCache_NegativeEntryExpires(t *testing.T) {
	dir := t.TempDir()
	c := NewCache(dir)
	// Negative with a TTL of -1s — already expired.
	if err := c.PutNegative("EXPIRED", -1*time.Second); err != nil {
		t.Fatal(err)
	}
	if c.IsNegative("EXPIRED") {
		t.Error("expected negative to be expired")
	}
}

func TestCache_NormalizesUUIDKey(t *testing.T) {
	// Callers may pass lowercase-with-dashes; cache stores uppercase.
	dir := t.TempDir()
	tmpFile := filepath.Join(dir, "bin")
	_ = os.WriteFile(tmpFile, []byte("v"), 0o644)
	info, _ := os.Stat(tmpFile)

	c := NewCache(dir)
	_ = c.Put(CacheEntry{UUID: "deadbeef-0000-0000-0000-000000000000", Path: tmpFile, MTime: info.ModTime().Unix()})
	if _, ok := c.Get("DEADBEEF-0000-0000-0000-000000000000"); !ok {
		t.Error("expected lookup with normalized UUID to hit")
	}
}

func TestCache_PutNegativeSeconds(t *testing.T) {
	c := NewCache(t.TempDir())
	if err := c.PutNegativeSeconds("TTL-SEC", 60); err != nil {
		t.Fatal(err)
	}
	if !c.IsNegative("TTL-SEC") {
		t.Error("expected PutNegativeSeconds to behave like PutNegative with equivalent TTL")
	}
}

// TestCache_OldFormatSilentlyDropped guards the fix for bead axiom-jtz (N1):
// a pre-versioned cache file (bare JSON array of CacheEntry) must not be
// deserialized by the new loader — the schema could add fields whose zero
// values would be silently wrong. The load drops it; the next Put rewrites
// in the v1 envelope.
func TestCache_OldFormatSilentlyDropped(t *testing.T) {
	dir := t.TempDir()
	bareArray := `[{"uuid":"LEGACY","path":"/tmp/old","arch":"arm64","image_name":"x","mtime":1}]`
	if err := os.WriteFile(filepath.Join(dir, "uuid-index.json"), []byte(bareArray), 0o644); err != nil {
		t.Fatal(err)
	}

	c := NewCache(dir)
	if _, ok := c.Get("LEGACY"); ok {
		t.Fatal("expected pre-versioned cache to be dropped rather than loaded under the new schema")
	}

	// Next Put must rewrite in the versioned envelope.
	tmpFile := filepath.Join(dir, "bin")
	_ = os.WriteFile(tmpFile, []byte("v"), 0o644)
	info, _ := os.Stat(tmpFile)
	if err := c.Put(CacheEntry{UUID: "NEW", Path: tmpFile, MTime: info.ModTime().Unix()}); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(dir, "uuid-index.json"))
	if err != nil {
		t.Fatal(err)
	}
	var env cacheFileV1
	if err := json.Unmarshal(data, &env); err != nil {
		t.Fatalf("rewritten cache should parse as cacheFileV1: %v", err)
	}
	if env.Version != cacheSchemaVersion {
		t.Errorf("rewritten cache version = %d, want %d", env.Version, cacheSchemaVersion)
	}
}

// TestCache_VersionMismatchDropsCache: a future-version envelope (written by
// a newer xcsym) is unreadable by the current binary — drop and rebuild,
// never partially deserialize.
func TestCache_VersionMismatchDropsCache(t *testing.T) {
	dir := t.TempDir()
	future := cacheFileV1{Version: 99, Entries: []CacheEntry{{UUID: "FUTURE", Path: "/x", Arch: "arm64"}}}
	data, _ := json.Marshal(future)
	if err := os.WriteFile(filepath.Join(dir, "uuid-index.json"), data, 0o644); err != nil {
		t.Fatal(err)
	}

	c := NewCache(dir)
	if _, ok := c.Get("FUTURE"); ok {
		t.Error("expected a cache version beyond cacheSchemaVersion to be dropped, not loaded")
	}
}

// TestCache_ConcurrentPutPreservesAllEntries guards the fix for bead
// axiom-jtz (C3): two xcsym processes racing on the same cache must not
// lose one another's entries. The previous code did an in-memory mutate
// followed by an atomic rename — atomic rename prevents torn reads but
// not lost updates. Fifty independent Cache instances writing unique UUIDs
// must all be visible on disk after the last one finishes.
//
// On macOS, syscall.Flock holds a per-open-file-description lock; each of
// the 50 goroutines opens its own .lock fd and serializes on it the same
// way two xcsym processes would.
func TestCache_ConcurrentPutPreservesAllEntries(t *testing.T) {
	dir := t.TempDir()
	tmpFile := filepath.Join(dir, "fixture-binary")
	if err := os.WriteFile(tmpFile, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	info, _ := os.Stat(tmpFile)

	const N = 50
	var wg sync.WaitGroup
	wg.Add(N)
	errs := make(chan error, N)
	for i := 0; i < N; i++ {
		go func(i int) {
			defer wg.Done()
			c := NewCache(dir)
			uuid := fmt.Sprintf("%08X-0000-0000-0000-%012X", i, i)
			if err := c.Put(CacheEntry{
				UUID:  uuid,
				Path:  tmpFile,
				Arch:  "arm64",
				MTime: info.ModTime().Unix(),
			}); err != nil {
				errs <- err
			}
		}(i)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Errorf("concurrent Put returned error: %v", err)
		}
	}

	// Verify all N entries survived — load a fresh Cache, check each UUID.
	final := NewCache(dir)
	missing := 0
	for i := 0; i < N; i++ {
		uuid := fmt.Sprintf("%08X-0000-0000-0000-%012X", i, i)
		if _, ok := final.Get(uuid); !ok {
			missing++
		}
	}
	if missing > 0 {
		t.Errorf("%d/%d UUIDs missing after concurrent Put — the RMW lost-update bug returned", missing, N)
	}
}

// TestCache_DiskFormatStability_V1 is the forward-compat fixture test noted
// in bead axiom-jtz. If someone bumps cacheSchemaVersion without updating
// this fixture, the test fails loudly — forcing a conscious decision about
// migration behavior rather than silently dropping every user's cache on
// upgrade.
func TestCache_DiskFormatStability_V1(t *testing.T) {
	// Fixture is hand-coded (not generated) so a refactor that changes field
	// JSON tags surfaces as a test failure rather than a silent re-serialize.
	fixture := `{
  "version": 1,
  "entries": [
    {
      "uuid": "ABCDEFAB-CDEF-ABCD-EFAB-CDEFABCDEFAB",
      "path": "/tmp/xcsym-fixture",
      "arch": "arm64e",
      "image_name": "Frobnicator",
      "mtime": 1700000000
    }
  ]
}`

	dir := t.TempDir()
	// Make the referenced path actually exist so Get doesn't evict on mtime.
	if err := os.WriteFile(filepath.Join(dir, "xcsym-fixture"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	info, _ := os.Stat(filepath.Join(dir, "xcsym-fixture"))
	// Rewrite fixture with the real mtime so Get accepts it.
	fixture = fmt.Sprintf(`{
  "version": 1,
  "entries": [
    {
      "uuid": "ABCDEFAB-CDEF-ABCD-EFAB-CDEFABCDEFAB",
      "path": %q,
      "arch": "arm64e",
      "image_name": "Frobnicator",
      "mtime": %d
    }
  ]
}`, filepath.Join(dir, "xcsym-fixture"), info.ModTime().Unix())

	if err := os.WriteFile(filepath.Join(dir, "uuid-index.json"), []byte(fixture), 0o644); err != nil {
		t.Fatal(err)
	}

	c := NewCache(dir)
	entry, ok := c.Get("ABCDEFAB-CDEF-ABCD-EFAB-CDEFABCDEFAB")
	if !ok {
		t.Fatal("v1 fixture failed to load — check that cacheSchemaVersion still matches the fixture or add a migration path")
	}
	if entry.Arch != "arm64e" || entry.ImageName != "Frobnicator" {
		t.Errorf("fixture round-trip: arch=%q image_name=%q, want arm64e / Frobnicator", entry.Arch, entry.ImageName)
	}
}

// TestSweepStaleTempFiles_RemovesOldKeepsFresh guards the fix for bead
// axiom-jtz (N2): NewCache invokes sweepStaleTempFiles to reclaim
// orphaned writeAtomic temp files (xcsym crashes between CreateTemp and
// Rename leave .xcsym-* behind). Files younger than the cutoff survive.
func TestSweepStaleTempFiles_RemovesOldKeepsFresh(t *testing.T) {
	dir := t.TempDir()
	stale := filepath.Join(dir, ".xcsym-stale")
	fresh := filepath.Join(dir, ".xcsym-fresh")
	unrelated := filepath.Join(dir, "not-a-tempfile.json")
	for _, p := range []string{stale, fresh, unrelated} {
		if err := os.WriteFile(p, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	// Age stale back past the cutoff.
	old := time.Now().Add(-25 * time.Hour)
	if err := os.Chtimes(stale, old, old); err != nil {
		t.Fatal(err)
	}

	sweepStaleTempFiles(dir, time.Hour)

	if _, err := os.Stat(stale); !os.IsNotExist(err) {
		t.Errorf("stale .xcsym-* should have been removed, got err=%v", err)
	}
	if _, err := os.Stat(fresh); err != nil {
		t.Errorf("fresh .xcsym-* should have survived the sweep: %v", err)
	}
	if _, err := os.Stat(unrelated); err != nil {
		t.Errorf("non-prefixed file should never be swept: %v", err)
	}
}
