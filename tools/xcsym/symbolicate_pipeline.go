package main

import (
	"context"
	"fmt"
)

// SymbolicateForTier mutates raw.Threads so each Frame that has a resolvable
// dSYM gains Symbol/File/Line. Runs per-image batches through atos. Silent
// on per-image failures — the frame stays unsymbolicated with Raw untouched
// so the rest of the pipeline still produces output.
//
// Scope by tier:
//   summary:  crashed thread only (Format will truncate to top 5)
//   standard: crashed thread + non-crashed threads' frames that hit an app
//             image (Format filters to top 20 app frames)
//   full:     every thread's every frame
//
// Pre-symbolicated frames (Symbolicated=true already, which .ips v2 often
// provides via on-device atos) are skipped. Only zero-symbol frames ask atos.
func SymbolicateForTier(ctx context.Context, raw *RawCrash, images ImageStatus, d *Discoverer, tier string) {
	if raw == nil || d == nil {
		return
	}
	threadIdxs := threadsForTier(raw, tier)
	if len(threadIdxs) == 0 {
		return
	}

	// Map image name → (UUID, arch, loadAddress) so we can look up by Frame.Image.
	imageByName := make(map[string]UsedImage)
	for _, img := range raw.UsedImages {
		imageByName[img.Name] = img
	}

	// Group unsymbolicated frames by image UUID so we batch one atos call
	// per image. Keep a back-reference so we can stamp results into the
	// right frame after atos returns.
	type frameRef struct{ ti, fi int }
	groupRefs := make(map[string][]frameRef)
	groupAddrs := make(map[string][]string)
	for _, ti := range threadIdxs {
		for fi, f := range raw.Threads[ti].Frames {
			if f.Symbolicated {
				continue
			}
			img, ok := imageByName[f.Image]
			if !ok || img.UUID == "" {
				continue
			}
			if f.Address == "" {
				continue
			}
			groupRefs[img.UUID] = append(groupRefs[img.UUID], frameRef{ti, fi})
			groupAddrs[img.UUID] = append(groupAddrs[img.UUID], f.Address)
		}
	}

	imageByUUID := make(map[string]UsedImage)
	for _, img := range raw.UsedImages {
		imageByUUID[img.UUID] = img
	}

	for uuid, refs := range groupRefs {
		addrs := groupAddrs[uuid]
		img, ok := imageByUUID[uuid]
		if !ok {
			continue
		}
		entry, err := d.Find(ctx, uuid, img.Arch)
		if err != nil {
			continue
		}
		loadAddr := fmt.Sprintf("0x%x", img.LoadAddress)
		results, err := ResolveBatch(ctx, entry.Path, entry.Arch, loadAddr, addrs)
		if err != nil {
			continue
		}
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
		}
	}
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
