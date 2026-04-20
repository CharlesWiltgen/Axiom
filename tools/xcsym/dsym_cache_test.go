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

// TestCache_FutureVersionEnvelopeClobberedOnPut documents the existing
// version-clobber policy (axiom-lub #1): when an older xcsym binary
// encounters a future-version envelope on disk, the next Put rewrites the
// file as v1 and the future entries do NOT survive. This is intentional —
// the older binary can't safely deserialize a schema it doesn't understand,
// so it drops and rebuilds. The newer xcsym's entries are lost, which costs
// at most one Find per UUID to repopulate.
//
// This test guards the policy. A future refactor that switches to "refuse
// to write when disk version > ours" (preserving the future binary's data
// at the cost of an unwritable cache for the older binary) would break this
// test loudly, forcing a deliberate decision about the trade-off.
func TestCache_FutureVersionEnvelopeClobberedOnPut(t *testing.T) {
	dir := t.TempDir()
	future := cacheFileV1{Version: 99, Entries: []CacheEntry{
		{UUID: "FUTURE-0000-0000-0000-000000000099", Path: "/x", Arch: "arm64", ImageName: "FromFuture", MTime: 42},
	}}
	data, _ := json.Marshal(future)
	if err := os.WriteFile(filepath.Join(dir, "uuid-index.json"), data, 0o644); err != nil {
		t.Fatal(err)
	}

	tmpFile := filepath.Join(dir, "bin")
	if err := os.WriteFile(tmpFile, []byte("v"), 0o644); err != nil {
		t.Fatal(err)
	}
	info, _ := os.Stat(tmpFile)

	c := NewCache(dir)
	if err := c.Put(CacheEntry{UUID: "NEW-FROM-OLD-BINARY", Path: tmpFile, MTime: info.ModTime().Unix()}); err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(filepath.Join(dir, "uuid-index.json"))
	if err != nil {
		t.Fatal(err)
	}
	var env cacheFileV1
	if err := json.Unmarshal(raw, &env); err != nil {
		t.Fatalf("rewritten cache should parse as cacheFileV1: %v", err)
	}
	if env.Version != cacheSchemaVersion {
		t.Errorf("rewritten envelope Version = %d, want %d (older binary should clobber the future version)", env.Version, cacheSchemaVersion)
	}
	if len(env.Entries) != 1 {
		t.Fatalf("rewritten envelope has %d entries, want 1 (future entries must not survive)", len(env.Entries))
	}
	got := env.Entries[0]
	if got.UUID != NormalizeUUID("NEW-FROM-OLD-BINARY") {
		t.Errorf("surviving entry UUID = %q, want %q (only the new Put should appear)", got.UUID, NormalizeUUID("NEW-FROM-OLD-BINARY"))
	}
	for _, e := range env.Entries {
		if e.ImageName == "FromFuture" {
			t.Errorf("future-version entry %q survived the rewrite — clobber policy regressed", e.UUID)
		}
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

// TestCache_GetDoesNotEvictPeerRefreshedEntry guards the double-check that
// Get performs under the flock before deleting. Scenario: c1 cached an entry
// at old mtime T0. The binary changes (mtime T1). c2 (a peer process)
// re-discovers and Puts the entry at T1. c1.Get sees its stale in-memory
// T0 vs current-disk T1, enters the eviction path — but by then disk has
// T1. Without the double-check, c1 would delete c2's correct entry.
func TestCache_GetDoesNotEvictPeerRefreshedEntry(t *testing.T) {
	dir := t.TempDir()
	tmpFile := filepath.Join(dir, "bin")
	if err := os.WriteFile(tmpFile, []byte("v0"), 0o644); err != nil {
		t.Fatal(err)
	}
	info0, _ := os.Stat(tmpFile)

	c1 := NewCache(dir)
	if err := c1.Put(CacheEntry{UUID: "K", Path: tmpFile, MTime: info0.ModTime().Unix()}); err != nil {
		t.Fatal(err)
	}

	// Change the binary — c1's in-memory MTime is now stale.
	later := info0.ModTime().Add(time.Hour)
	if err := os.Chtimes(tmpFile, later, later); err != nil {
		t.Fatal(err)
	}
	info1, _ := os.Stat(tmpFile)

	// Peer process refreshes the disk cache with the new mtime.
	c2 := NewCache(dir)
	if err := c2.Put(CacheEntry{UUID: "K", Path: tmpFile, MTime: info1.ModTime().Unix()}); err != nil {
		t.Fatal(err)
	}

	// c1.Get sees in-memory T0 vs disk T1 and enters eviction. The
	// double-check must recognize that disk now has T1 and spare the entry.
	if _, ok := c1.Get("K"); ok {
		// It's fine either way for c1's return — Get returning miss is OK
		// (caller re-scans). What matters is the disk state after.
		t.Log("c1.Get returned hit (freshness check picked up peer's update)")
	}

	// A subsequent NewCache must still see K on disk with the fresh mtime.
	c3 := NewCache(dir)
	got, ok := c3.Get("K")
	if !ok {
		t.Fatal("c1's eviction clobbered a peer-refreshed entry — the Get double-check regressed")
	}
	if got.MTime != info1.ModTime().Unix() {
		t.Errorf("surviving entry mtime = %d, want %d", got.MTime, info1.ModTime().Unix())
	}
}

// TestCache_GetEvictsGenuinelyStaleEntry is the negative control for
// TestCache_GetDoesNotEvictPeerRefreshedEntry: when the on-disk state
// really is stale (no peer refresh), eviction must still happen.
func TestCache_GetEvictsGenuinelyStaleEntry(t *testing.T) {
	dir := t.TempDir()
	tmpFile := filepath.Join(dir, "bin")
	if err := os.WriteFile(tmpFile, []byte("v0"), 0o644); err != nil {
		t.Fatal(err)
	}
	info0, _ := os.Stat(tmpFile)

	c := NewCache(dir)
	if err := c.Put(CacheEntry{UUID: "K", Path: tmpFile, MTime: info0.ModTime().Unix()}); err != nil {
		t.Fatal(err)
	}

	// Change the binary and don't refresh the cache — entry is truly stale.
	later := info0.ModTime().Add(time.Hour)
	if err := os.Chtimes(tmpFile, later, later); err != nil {
		t.Fatal(err)
	}

	if _, ok := c.Get("K"); ok {
		t.Error("expected cache miss for stale entry")
	}
	// After Get's eviction, a fresh instance must see K gone.
	c2 := NewCache(dir)
	if _, ok := c2.Get("K"); ok {
		t.Error("stale entry survived Get's eviction")
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
