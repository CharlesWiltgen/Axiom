package main

import (
	"context"
	"errors"
	"fmt"
)

// Mismatch kind classifications (exposed in ImageMatch.Kind for Mismatched entries).
const (
	MismatchUUID = "uuid" // dSYM UUID doesn't line up with the crash image UUID
	MismatchArch = "arch" // right UUID, wrong slice (e.g. arm64 crash, arm64-only dSYM)
)

// VerifyImages resolves every image in raw.UsedImages against the Discoverer
// and classifies each as matched, mismatched (uuid or arch), or missing.
// Images with an empty UUID are ignored — parsers emit those as placeholders
// for unknown frames and they carry no symbol debt.
//
// Error semantics:
//   - nil error: status is complete and classifications are final.
//   - non-nil error: a tool (mdfind/dwarfdump) failed or timed out partway
//     through. Partial status is returned alongside the error so callers can
//     still emit useful output, but the error should dominate exit-code
//     selection (e.g. timeout → exit 6, other → exit 5).
//
// For an explicit override, the discoverer returns whatever path was given
// without verifying UUIDs. This function re-reads the bundle's true UUIDs
// via dwarfdump so a wrong-UUID override is caught as MismatchUUID and a
// wrong-arch override is caught as MismatchArch. If the binary can't be
// probed at all (unreadable file, non-Mach-O), we report MismatchUUID with
// no real arch — better than silently declaring a match.
func VerifyImages(ctx context.Context, d *Discoverer, raw *RawCrash) (ImageStatus, error) {
	status := ImageStatus{
		Matched:    []ImageMatch{},
		Mismatched: []ImageMatch{},
		Missing:    []ImageMiss{},
	}
	for _, img := range raw.UsedImages {
		uuid := NormalizeUUID(img.UUID)
		if uuid == "" {
			continue
		}
		entry, err := d.Find(ctx, uuid, img.Arch)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				status.Missing = append(status.Missing, ImageMiss{
					UUID: uuid, Name: img.Name, Arch: img.Arch,
					Reason: "not found in explicit, cache, Spotlight, Archives, DerivedData, frameworks, Downloads, toolchain, or XCSYM_DSYM_PATHS",
				})
				continue
			}
			return status, fmt.Errorf("resolve UUID %s: %w", uuid, err)
		}

		// For explicit overrides (both global and per-UUID), cross-check the
		// actual UUIDs reported by dwarfdump against the requested UUID + arch.
		// Non-explicit sources already filter on UUID during discovery.
		if entry.Source == "explicit" {
			kind, realArch, cerr := classifyExplicit(ctx, entry.Path, uuid, img.Arch)
			if cerr != nil {
				return status, fmt.Errorf("inspect explicit dSYM %s: %w", entry.Path, cerr)
			}
			switch kind {
			case MismatchUUID:
				status.Mismatched = append(status.Mismatched, ImageMatch{
					UUID: uuid, Name: img.Name, Arch: img.Arch, DsymPath: entry.Path, Kind: MismatchUUID,
				})
				continue
			case MismatchArch:
				status.Mismatched = append(status.Mismatched, ImageMatch{
					UUID: uuid, Name: img.Name, Arch: realArch, DsymPath: entry.Path, Kind: MismatchArch,
				})
				continue
			}
			if realArch != "" {
				entry.Arch = realArch
			}
		} else if img.Arch != "" && entry.Arch != "" && entry.Arch != img.Arch {
			// Discovery found a dSYM with the right UUID but wrong slice.
			status.Mismatched = append(status.Mismatched, ImageMatch{
				UUID: uuid, Name: img.Name, Arch: entry.Arch, DsymPath: entry.Path, Kind: MismatchArch,
			})
			continue
		}

		status.Matched = append(status.Matched, ImageMatch{
			UUID: uuid, Name: img.Name, Arch: entry.Arch, DsymPath: entry.Path,
		})
	}
	return status, nil
}

// classifyExplicit inspects the binary at path and returns:
//
//	"", realArch      → UUID present (realArch is the matching slice's arch)
//	MismatchUUID, "" → UUID not found in the binary, or the binary can't be probed
//	MismatchArch, realArch → UUID found, but reqArch isn't one of its slices
//
// A tool timeout or ctx cancellation is returned as an error so VerifyImages
// can exit with the right code instead of silently declaring a match.
func classifyExplicit(ctx context.Context, path, uuid, reqArch string) (string, string, error) {
	entries, err := ReadUUIDs(ctx, path)
	if err != nil {
		if isHardToolError(ctx, err) {
			return "", "", err
		}
		// Non-fatal dwarfdump failure: the path exists but isn't a probe-able
		// binary (wrong file type, malformed, stripped). Don't silently match.
		return MismatchUUID, "", nil
	}
	if len(entries) == 0 {
		return MismatchUUID, "", nil
	}
	var found bool
	var firstArch string
	for _, e := range entries {
		if e.UUID != uuid {
			continue
		}
		found = true
		if firstArch == "" {
			firstArch = e.Arch
		}
		if reqArch == "" || e.Arch == reqArch {
			return "", e.Arch, nil
		}
	}
	if !found {
		return MismatchUUID, "", nil
	}
	return MismatchArch, firstArch, nil
}

// StatusCategory summarizes an ImageStatus for exit-code mapping:
//
//	all_matched    — no missing, no mismatched (exit 0)
//	mismatch_uuid  — at least one UUID mismatch (exit 3)
//	mismatch_arch  — at least one arch-slice mismatch, no UUID mismatches (exit 4)
//	partial        — any missing image (exit 7)
//
// Priority: partial > mismatch_uuid > mismatch_arch > all_matched. Missing
// images dominate because they block symbolication entirely; UUID mismatches
// dominate arch mismatches because they indicate a wrong dSYM, not slice.
//
// Every Mismatched entry must have a Kind set. An untagged entry signals a
// contract violation upstream and panics to force the regression to surface
// loudly rather than silently miscategorize.
func StatusCategory(s ImageStatus) string {
	if len(s.Missing) > 0 {
		return "partial"
	}
	var hasUUID, hasArch bool
	for _, m := range s.Mismatched {
		switch m.Kind {
		case MismatchUUID:
			hasUUID = true
		case MismatchArch:
			hasArch = true
		default:
			panic(fmt.Sprintf("StatusCategory: Mismatched entry for UUID %q has empty Kind; every Mismatched must be tagged", m.UUID))
		}
	}
	switch {
	case hasUUID:
		return "mismatch_uuid"
	case hasArch:
		return "mismatch_arch"
	}
	return "all_matched"
}
