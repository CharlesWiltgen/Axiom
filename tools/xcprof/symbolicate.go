package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// dsymLookupTimeout bounds the mdfind/dwarfdump/atos shell-outs. These are fast
// (Spotlight is indexed; atos is local), so a tight budget keeps a hung tool
// from stalling analysis. Independent of the generous xctrace-export timeout.
const dsymLookupTimeout = 10 * time.Second

// symbolizeResult reports the outcome of a --dsym symbolication pass, so the
// report can state honestly how many raw-address frames were named.
type symbolizeResult struct {
	Attempted  bool
	Explicit   bool // a --dsym path was supplied (changes the unresolved-note wording)
	Resolved   int
	Unresolved int // address frames still unnamed (no UUID, no dSYM, or atos miss)
}

// findDsymFn and atosResolveFn are the impure shell-outs behind function vars
// so the grouping/apply logic in symbolizeSamples is unit-testable with fakes.
var (
	findDsymFn    = findDsym
	atosResolveFn = atosResolve
)

// binKey groups frames resolvable by one atos invocation: same image (UUID),
// same arch, same load address.
type binKey struct{ uuid, arch, loadAddr string }

// symbolizeSamples resolves raw-address frames in place. explicit is an
// optional --dsym path (a .dSYM bundle or Mach-O); when empty, dSYMs are found
// by UUID via Spotlight. Frames without a UUID or without a matching dSYM are
// left untouched (honest fallback — never invented). Returns counts for a note.
//
// This is the minimal slice (Spotlight + explicit override). Fuller discovery
// (Archives/DerivedData walks, shared with xcsym) is tracked in axiom-fo7k.
func symbolizeSamples(ctx context.Context, samples []Sample, explicit string) symbolizeResult {
	res := symbolizeResult{Attempted: true, Explicit: explicit != ""}

	// 1. Collect distinct addresses needing resolution, grouped by image.
	need := map[binKey]map[string]struct{}{}
	for _, s := range samples {
		for _, f := range s.Frames {
			if !resolvable(f) {
				continue
			}
			k := binKey{f.UUID, f.Arch, f.LoadAddr}
			if need[k] == nil {
				need[k] = map[string]struct{}{}
			}
			need[k][f.Addr] = struct{}{}
		}
	}
	if len(need) == 0 {
		return res
	}

	// 2. Resolve per image: find the dSYM once per UUID (memoized), then batch
	//    atos for all of that image's addresses.
	resolved := map[binKey]map[string]string{}
	dsymByUUID := map[string]string{} // uuid -> DWARF binary path ("" = not found)
	for k, addrSet := range need {
		dwarf, seen := dsymByUUID[k.uuid]
		if !seen {
			dwarf, _ = findDsymFn(ctx, k.uuid, k.arch, explicit)
			dsymByUUID[k.uuid] = dwarf
		}
		if dwarf == "" {
			continue
		}
		names, err := atosResolveFn(ctx, dwarf, k.arch, k.loadAddr, sortedAddrs(addrSet))
		if err != nil || len(names) == 0 {
			continue
		}
		resolved[k] = names
	}

	// 3. Apply names in place; count resolved vs still-raw.
	for si := range samples {
		for fi := range samples[si].Frames {
			f := &samples[si].Frames[fi]
			if !resolvable(*f) {
				continue
			}
			k := binKey{f.UUID, f.Arch, f.LoadAddr}
			if names := resolved[k]; names != nil {
				if nm := names[f.Addr]; nm != "" && !strings.HasPrefix(nm, "0x") {
					f.Name = nm
					res.Resolved++
					continue
				}
			}
			res.Unresolved++
		}
	}
	return res
}

// resolvable reports whether a frame is a raw address we can attempt to name:
// unsymbolicated, with both a UUID (to find the dSYM) and an address.
func resolvable(f Frame) bool {
	return isUnsymbolicated(f) && f.UUID != "" && f.Addr != ""
}

func sortedAddrs(set map[string]struct{}) []string {
	out := make([]string, 0, len(set))
	for a := range set {
		out = append(out, a)
	}
	sort.Strings(out)
	return out
}

// findDsym returns the Mach-O to feed `atos -o` for the given image UUID. With
// an explicit --dsym path it resolves the DWARF binary inside that bundle (or
// uses the path directly if it's a plain Mach-O); otherwise it asks Spotlight
// for a bundle indexed with the UUID and confirms the match via dwarfdump.
func findDsym(ctx context.Context, uuid, arch, explicit string) (string, error) {
	if explicit != "" {
		return dwarfBinaryFor(ctx, explicit, uuid), nil
	}
	res, err := ExecRun(ctx, dsymLookupTimeout, "mdfind", fmt.Sprintf("com_apple_xcode_dsym_uuids == %q", uuid))
	if err != nil {
		return "", err
	}
	for _, bundle := range strings.Split(strings.TrimSpace(string(res.Stdout)), "\n") {
		if bundle = strings.TrimSpace(bundle); bundle == "" {
			continue
		}
		if bin := dwarfBinaryFor(ctx, bundle, uuid); bin != "" {
			return bin, nil
		}
	}
	return "", nil
}

// dwarfBinaryFor returns the inner Mach-O of a .dSYM bundle whose DWARF carries
// uuid — selected BY UUID, not blindly the first entry, so a bundle with more
// than one DWARF binary resolves the right image. A non-bundle path is treated
// as a plain Mach-O and returned only if it carries the UUID. "" means no match
// (caller leaves the frame raw — honest fallback). Confirming the UUID also
// guards the explicit --dsym path against a wrong/mismatched bundle.
func dwarfBinaryFor(ctx context.Context, path, uuid string) string {
	dwarf := filepath.Join(path, "Contents", "Resources", "DWARF")
	if entries, err := os.ReadDir(dwarf); err == nil {
		for _, e := range entries {
			if bin := filepath.Join(dwarf, e.Name()); dsymHasUUID(ctx, bin, uuid) {
				return bin
			}
		}
		return ""
	}
	if dsymHasUUID(ctx, path, uuid) {
		return path
	}
	return ""
}

// dsymHasUUID confirms a candidate Mach-O actually carries the requested UUID
// (Spotlight results can be stale after a rebuild).
func dsymHasUUID(ctx context.Context, bin, uuid string) bool {
	res, err := ExecRun(ctx, dsymLookupTimeout, "xcrun", "dwarfdump", "--uuid", bin)
	if err != nil {
		return false
	}
	return strings.Contains(strings.ToUpper(string(res.Stdout)), strings.ToUpper(uuid))
}

// atosResolve runs one atos invocation for all addresses of a single image,
// returning addr -> symbol name (a still-raw "0x…" means atos couldn't name it).
func atosResolve(ctx context.Context, dwarfBinary, arch, loadAddr string, addrs []string) (map[string]string, error) {
	if len(addrs) == 0 {
		return nil, nil
	}
	res, err := ExecRun(ctx, dsymLookupTimeout, "atos", atosArgs(dwarfBinary, arch, loadAddr, addrs)...)
	if err != nil {
		return nil, err
	}
	return mapAtosLines(addrs, res.Stdout), nil
}

// mapAtosLines pairs each input address with atos's i-th output line (atos
// emits one line per address, in order). Stray leading/trailing blank lines are
// trimmed; if the line and address counts still disagree we return nil — treat
// the whole batch as a miss rather than risk pairing a name with the wrong
// address. A misattribution would invent a wrong name, violating the
// never-invented contract; an empty result just leaves frames raw.
func mapAtosLines(addrs []string, stdout []byte) map[string]string {
	lines := strings.Split(strings.Trim(string(stdout), "\n"), "\n")
	if len(lines) != len(addrs) {
		return nil
	}
	out := make(map[string]string, len(addrs))
	for i, a := range addrs {
		out[a] = parseAtosName(lines[i])
	}
	return out
}

// atosArgs builds the atos argument vector. arch/loadAddr are omitted when
// empty so atos falls back to its own defaults.
func atosArgs(dwarfBinary, arch, loadAddr string, addrs []string) []string {
	args := []string{"-o", dwarfBinary}
	if arch != "" {
		args = append(args, "-arch", arch)
	}
	if loadAddr != "" {
		args = append(args, "-l", loadAddr)
	}
	return append(args, addrs...)
}

// parseAtosName keeps the symbol, dropping the " (in image) (file:line)" suffix
// atos appends. An unresolved address comes back as the raw "0x…".
func parseAtosName(line string) string {
	line = strings.TrimSpace(line)
	if i := strings.Index(line, " (in "); i >= 0 {
		return strings.TrimSpace(line[:i])
	}
	return line
}
