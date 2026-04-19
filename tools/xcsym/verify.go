package main

import (
	"context"
)

// VerifyImages resolves every image in raw.UsedImages against the Discoverer
// and classifies each as matched, mismatched (wrong arch slice), or missing.
// Images with an empty UUID are ignored — parsers emit those as placeholders
// for unknown frames and they carry no symbol debt.
//
// For an explicit override (--dsym), the Discoverer echoes whatever arch the
// caller requested, so we re-read the bundle's real UUIDs via dwarfdump to
// detect arch mismatches the discoverer couldn't catch on its own.
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
		// Resolve the dSYM's true arch(es) for a definitive comparison. For
		// non-explicit sources the walker already set entry.Arch; for
		// explicit, fall back to the first UUID record on the binary.
		realArch := entry.Arch
		if entry.Source == "explicit" && img.Arch != "" {
			realArch = resolveRealArch(ctx, entry.Path, uuid)
		}
		if img.Arch != "" && realArch != "" && realArch != img.Arch {
			status.Mismatched = append(status.Mismatched, ImageMatch{
				UUID: uuid, Name: img.Name, Arch: realArch, DsymPath: entry.Path,
			})
			continue
		}
		status.Matched = append(status.Matched, ImageMatch{
			UUID: uuid, Name: img.Name, Arch: realArch, DsymPath: entry.Path,
		})
	}
	return status, nil
}

// resolveRealArch reads dwarfdump --uuid on the dSYM (or Mach-O) at path and
// returns the arch for the given UUID. Returns "" when the UUID isn't found
// or dwarfdump fails — callers treat that as "no mismatch detected".
func resolveRealArch(ctx context.Context, path, uuid string) string {
	entries, err := ReadUUIDs(ctx, path)
	if err != nil {
		return ""
	}
	for _, e := range entries {
		if e.UUID == uuid {
			return e.Arch
		}
	}
	return ""
}

// StatusCategory summarizes an ImageStatus for exit-code mapping:
//
//	all_matched — no missing, no mismatched (exit 0)
//	mismatch    — at least one mismatch, no missing (exit 3)
//	partial     — any missing image, with or without matches (exit 7)
func StatusCategory(s ImageStatus) string {
	if len(s.Missing) > 0 {
		return "partial"
	}
	if len(s.Mismatched) > 0 {
		return "mismatch"
	}
	return "all_matched"
}
