package main

import (
	"bufio"
	"bytes"
	"context"
	"regexp"
	"strings"
)

// UUIDEntry captures one UUID/arch pair from dwarfdump --uuid output.
type UUIDEntry struct {
	UUID string
	Arch string
	Path string
}

// ReadUUIDs runs `xcrun dwarfdump --uuid <path>` and parses every line.
// Works on both dSYMs and Mach-O binaries.
//
// We route through xcrun because `dwarfdump` on developer machines is often
// shadowed by homebrew's GNU binutils dwarfdump, which doesn't support the
// --uuid flag. xcrun always resolves to Apple's toolchain binary.
func ReadUUIDs(ctx context.Context, path string) ([]UUIDEntry, error) {
	res, err := ExecRun(ctx, 0, "xcrun", "dwarfdump", "--uuid", path)
	if err != nil {
		return nil, err
	}
	return parseDwarfdumpUUIDs(res.Stdout), nil
}

var uuidLineRe = regexp.MustCompile(`^UUID:\s+([0-9A-Fa-f-]+)\s+\(([^)]+)\)\s+(.+)$`)

func parseDwarfdumpUUIDs(out []byte) []UUIDEntry {
	var entries []UUIDEntry
	sc := bufio.NewScanner(bytes.NewReader(out))
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		m := uuidLineRe.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		entries = append(entries, UUIDEntry{
			UUID: strings.ToUpper(m[1]),
			Arch: m[2],
			Path: m[3],
		})
	}
	return entries
}

// NormalizeUUID returns the uppercase UUID with dashes, matching dwarfdump output.
// Inputs that don't contain exactly 32 hex digits (after removing dashes) are
// returned upper-cased but otherwise untouched so callers can error on them.
func NormalizeUUID(in string) string {
	upper := strings.ToUpper(in)
	stripped := strings.ReplaceAll(upper, "-", "")
	if len(stripped) != 32 {
		return upper
	}
	for _, c := range stripped {
		if !((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F')) {
			return upper
		}
	}
	return stripped[0:8] + "-" + stripped[8:12] + "-" + stripped[12:16] + "-" + stripped[16:20] + "-" + stripped[20:32]
}
