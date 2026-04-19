package main

import (
	"context"
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
// For an explicit override (--dsym), the discoverer returns whatever the
// caller pointed at without verifying UUIDs. This function re-reads the
// bundle's true UUIDs via dwarfdump so a wrong-UUID override is caught as
// MismatchUUID, and a wrong-arch override is caught as MismatchArch.
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
			status.Missing = append(status.Missing, ImageMiss{
				UUID: uuid, Name: img.Name, Arch: img.Arch,
				Reason: "not found in explicit, cache, Spotlight, Archives, DerivedData, frameworks, Downloads, toolchain, or XCSYM_DSYM_PATHS",
			})
			continue
		}

		// For explicit overrides, cross-check the actual UUIDs reported by
		// dwarfdump against the requested UUID + arch. Non-explicit sources
		// already filter on UUID during discovery.
		if entry.Source == "explicit" {
			kind, realArch := classifyExplicit(ctx, entry.Path, uuid, img.Arch)
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
			// kind == "" → match; fall through with realArch if we resolved one.
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
//	"", realArch      → UUID present (realArch may be "" if dwarfdump failed)
//	MismatchUUID, ""  → UUID not found anywhere in the binary
//	MismatchArch, realArch → UUID found, but reqArch missing
func classifyExplicit(ctx context.Context, path, uuid, reqArch string) (string, string) {
	entries, err := ReadUUIDs(ctx, path)
	if err != nil || len(entries) == 0 {
		// Can't probe — trust the caller and don't flag a mismatch.
		return "", ""
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
			return "", e.Arch
		}
	}
	if !found {
		return MismatchUUID, ""
	}
	return MismatchArch, firstArch
}

// StatusCategory summarizes an ImageStatus for exit-code mapping:
//
//	all_matched    — no missing, no mismatched (exit 0)
//	mismatch_uuid  — at least one UUID mismatch (exit 3)
//	mismatch_arch  — at least one arch-slice mismatch, no UUID mismatches (exit 4)
//	partial        — any missing image (exit 7)
//
// Priority order: partial > mismatch_uuid > mismatch_arch > all_matched.
// Missing images dominate because they block symbolication entirely; UUID
// mismatches dominate arch mismatches because they indicate a wrong dSYM,
// not a wrong slice.
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
			// Legacy/untagged mismatch — treat conservatively as UUID.
			hasUUID = true
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
