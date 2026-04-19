package main

import (
	"os"
	"path/filepath"
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
