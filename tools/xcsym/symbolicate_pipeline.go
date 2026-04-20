package main

import (
	"context"
	"errors"
	"fmt"
)

// SymbolicateForTier mutates raw.Threads so each Frame that has a resolvable
// dSYM gains Symbol/File/Line. Runs per-image batches through atos. Returns
// a (possibly empty) slice of warnings describing per-image failures —
// dSYM not found, atos returned nothing, atos errored out. The caller
// threads these into CrashReport.Warnings so the user sees why frames
// didn't symbolicate instead of just a silent `"symbolicated": false`.
// axiom-ogk.
//
// Frame-level Raw is left untouched on any per-image failure so the rest
// of the pipeline still produces output.
//
// Scope by tier:
//   summary:  crashed thread only (Format will truncate to top 5)
//   standard: crashed thread + non-crashed threads' frames that hit an app
//             image (Format filters to top 20 app frames)
//   full:     every thread's every frame
//
// Pre-symbolicated frames (Symbolicated=true already, which .ips v2 often
// provides via on-device atos) are skipped. Only zero-symbol frames ask atos.
func SymbolicateForTier(ctx context.Context, raw *RawCrash, images ImageStatus, d *Discoverer, tier string) []string {
	if raw == nil || d == nil {
		return nil
	}
	threadIdxs := threadsForTier(raw, tier)
	if len(threadIdxs) == 0 {
		return nil
	}

	g := buildFrameGroups(raw, threadIdxs)
	var warnings []string

	for uuid, refs := range g.refs {
		addrs := g.addrs[uuid]
		img, ok := g.imagesByUUID[uuid]
		if !ok {
			continue
		}
		entry, err := d.Find(ctx, uuid, img.Arch)
		if err != nil {
			warnings = append(warnings, symbolicateWarning(uuid, img.Name, "discover", err, len(refs)))
			continue
		}
		loadAddr := fmt.Sprintf("0x%x", img.LoadAddress)
		results, err := resolveBatchFn(ctx, entry.Path, entry.Arch, loadAddr, addrs)
		if err != nil {
			warnings = append(warnings, symbolicateWarning(uuid, img.Name, "atos", err, len(refs)))
			continue
		}
		stamped := 0
		for i, ref := range refs {
			if i >= len(results) || results[i] == nil {
				continue
			}
			r := results[i]
			if !r.Symbolicated {
				continue
			}
			frame := &raw.Threads[ref.ti].Frames[ref.fi]
			frame.Symbol = r.Symbol
			frame.File = r.File
			frame.Line = r.Line
			frame.Symbolicated = true
			stamped++
		}
		// atos returned a batch but none of the addresses resolved to a
		// symbol — usually indicates a dSYM/address-space mismatch that
		// Find didn't catch. Worth flagging so the user sees why the
		// symbolicated flag stayed false on these frames.
		if stamped == 0 {
			warnings = append(warnings, fmt.Sprintf(
				"symbolicate: %s (UUID %s) — dSYM found but atos returned no symbols for %d frames",
				img.Name, uuid, len(refs)))
		}
	}
	return warnings
}

// symbolicateWarning builds a one-line human-readable warning for a
// per-image symbolicate failure. Distinguishes "dSYM not found"
// (ErrNotFound), timeout, and other errors so the reader can tell
// recoverable cases from environmental ones. axiom-ogk.
func symbolicateWarning(uuid, imageName, phase string, err error, frameCount int) string {
	name := imageName
	if name == "" {
		name = "<unnamed>"
	}
	switch {
	case errors.Is(err, ErrNotFound):
		return fmt.Sprintf(
			"symbolicate: %s (UUID %s) — dSYM not found; %d frames left unsymbolicated",
			name, uuid, frameCount)
	case IsTimeoutError(err):
		return fmt.Sprintf(
			"symbolicate: %s (UUID %s) — %s timed out; %d frames left unsymbolicated",
			name, uuid, phase, frameCount)
	default:
		return fmt.Sprintf(
			"symbolicate: %s (UUID %s) — %s failed (%v); %d frames left unsymbolicated",
			name, uuid, phase, err, frameCount)
	}
}

// frameRef locates a frame inside raw.Threads by thread and frame index,
// so atos results can be stamped back into the right Frame once grouped
// calls return.
type frameRef struct{ ti, fi int }

// frameGroups holds unsymbolicated frames grouped by image UUID. Keying by
// UUID (plumbed into Frame.UUID at parse time) prevents cross-attribution
// when two UsedImages share a Name — a real case with multi-framework copies
// and MetricKit's binaryName-can-repeat semantics. See axiom-mv5.
type frameGroups struct {
	refs         map[string][]frameRef // UUID → frame back-references
	addrs        map[string][]string   // UUID → atos addresses (parallel to refs)
	imagesByUUID map[string]UsedImage
}

// buildFrameGroups returns the per-UUID grouping the symbolicate pass feeds
// to atos. Frames are skipped (not crashed on) when:
//   - already symbolicated (on-device atos filled them in)
//   - Frame.UUID is empty (imageIndex was out of range at parse time)
//   - UsedImages has no entry for that UUID (defensive)
//   - Address is empty (no meaningful atos input)
func buildFrameGroups(raw *RawCrash, threadIdxs []int) frameGroups {
	g := frameGroups{
		refs:         make(map[string][]frameRef),
		addrs:        make(map[string][]string),
		imagesByUUID: make(map[string]UsedImage),
	}
	for _, img := range raw.UsedImages {
		if img.UUID == "" {
			continue
		}
		g.imagesByUUID[img.UUID] = img
	}
	for _, ti := range threadIdxs {
		if ti < 0 || ti >= len(raw.Threads) {
			continue
		}
		for fi, f := range raw.Threads[ti].Frames {
			if f.Symbolicated {
				continue
			}
			if f.UUID == "" {
				continue
			}
			if _, ok := g.imagesByUUID[f.UUID]; !ok {
				continue
			}
			if f.Address == "" {
				continue
			}
			g.refs[f.UUID] = append(g.refs[f.UUID], frameRef{ti, fi})
			g.addrs[f.UUID] = append(g.addrs[f.UUID], f.Address)
		}
	}
	return g
}

// threadsForTier returns the indices of threads that should be symbolicated
// for a given tier. The crashed thread is always included.
func threadsForTier(raw *RawCrash, tier string) []int {
	var out []int
	if raw.CrashedIdx >= 0 && raw.CrashedIdx < len(raw.Threads) {
		out = append(out, raw.CrashedIdx)
	}
	if tier == TierSummary {
		return out
	}
	// Standard + full: include non-crashed threads too. Per-frame filtering
	// by image happens at collection time; symbolicating "extra" frames is
	// wasted work but correct (Format truncates the output anyway).
	for i := range raw.Threads {
		if i == raw.CrashedIdx {
			continue
		}
		out = append(out, i)
	}
	return out
}
