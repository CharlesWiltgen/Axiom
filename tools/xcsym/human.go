package main

import (
	"fmt"
	"io"
)

// This file holds the --human prose renderers for xcsym's report subcommands.
// Default output is compact JSON (token-lean for the crash-analyzer agent);
// --human opts into a terse, readable rendering for a person at a terminal.
// `anonymize` has no renderer here — its output is a crash document in the .ips
// wire format, not a report.

// frameLine renders one stack frame: a resolved symbol (with file:line when
// present) or the raw address + image when unsymbolicated.
func frameLine(f Frame) string {
	if f.Symbolicated && f.Symbol != "" {
		if f.File != "" {
			return fmt.Sprintf("%s  (%s:%d)", f.Symbol, f.File, f.Line)
		}
		return f.Symbol
	}
	return fmt.Sprintf("%s  %s", f.Address, f.Image)
}

func renderCrashHuman(w io.Writer, r *CrashReport) {
	c := r.Crash
	fmt.Fprintf(w, "crash: %s (%s)\n", c.PatternTag, c.PatternConfidence)
	fmt.Fprintf(w, "  app: %s %s (%s)\n", c.App.Name, c.App.Version, c.App.BundleID)
	sim := ""
	if c.OS.IsSimulator {
		sim = " simulator"
	}
	fmt.Fprintf(w, "  os: %s %s (%s)%s\n", c.OS.Platform, c.OS.Version, c.OS.Build, sim)
	exc := c.Exception.Type
	if c.Exception.Signal != "" {
		exc += " / " + c.Exception.Signal
	}
	fmt.Fprintf(w, "  exception: %s\n", exc)
	if c.Exception.Subtype != "" {
		fmt.Fprintf(w, "  subtype: %s\n", c.Exception.Subtype)
	}
	if c.PatternReason != "" {
		fmt.Fprintf(w, "  reason: %s\n", c.PatternReason)
	}

	const maxFrames = 8
	fmt.Fprintf(w, "  crashed thread %d:\n", c.CrashedThread.Index)
	frames := c.CrashedThread.Frames
	shown := len(frames)
	if shown > maxFrames {
		shown = maxFrames
	}
	for i := 0; i < shown; i++ {
		fmt.Fprintf(w, "    %2d  %s\n", frames[i].Index, frameLine(frames[i]))
	}
	if len(frames) > shown {
		fmt.Fprintf(w, "    … %d more frames\n", len(frames)-shown)
	}

	switch {
	case r.Images != nil:
		fmt.Fprintf(w, "  images: %d matched · %d mismatched · %d missing\n",
			len(r.Images.Matched), len(r.Images.Mismatched), len(r.Images.Missing))
	case r.ImagesSummary != nil:
		fmt.Fprintf(w, "  images: %d matched · %d mismatched · %d missing\n",
			r.ImagesSummary.MatchedCount, r.ImagesSummary.MismatchedCount, r.ImagesSummary.MissingCount)
	}
	for _, warn := range r.Warnings {
		fmt.Fprintf(w, "  warning: %s\n", warn)
	}
}

func renderVerifyHuman(w io.Writer, r verifyOutput) {
	fmt.Fprintf(w, "verify: %s  (%s, %s)\n", r.Category, r.Input.Path, r.Input.Format)
	fmt.Fprintf(w, "  matched: %d · mismatched: %d · missing: %d\n",
		len(r.Images.Matched), len(r.Images.Mismatched), len(r.Images.Missing))
	for _, m := range r.Images.Missing {
		fmt.Fprintf(w, "  missing   %s %s\n", m.Name, m.UUID)
	}
	for _, m := range r.Images.Mismatched {
		kind := m.Kind
		if kind == "" {
			kind = "mismatch"
		}
		fmt.Fprintf(w, "  %-8s %s %s\n", kind, m.Name, m.UUID)
	}
}

func renderResolveHuman(w io.Writer, r resolveOutput) {
	fmt.Fprintf(w, "resolve: %s", r.Dsym)
	if r.Arch != "" {
		fmt.Fprintf(w, " (arch %s)", r.Arch)
	}
	fmt.Fprintf(w, " · load %s\n", r.Load)
	for _, res := range r.Results {
		switch {
		case res.Symbolicated && res.Symbol != "" && res.File != "":
			fmt.Fprintf(w, "  %s → %s  (%s:%d)\n", res.Address, res.Symbol, res.File, res.Line)
		case res.Symbolicated && res.Symbol != "":
			fmt.Fprintf(w, "  %s → %s\n", res.Address, res.Symbol)
		default:
			fmt.Fprintf(w, "  %s → %s [unsymbolicated]\n", res.Address, res.Raw)
		}
	}
}

func renderFindDsymHuman(w io.Writer, r findDsymOutput) {
	fmt.Fprintf(w, "find-dsym: %s\n", r.UUID)
	fmt.Fprintf(w, "  found: %s\n", r.Path)
	fmt.Fprintf(w, "  arch %s · image %s · source %s\n", r.Arch, r.ImageName, r.Source)
}

func renderListDsymsHuman(w io.Writer, r listDsymsOutput) {
	fmt.Fprintf(w, "list-dsyms: %d bundle(s) across %d root(s)\n", len(r.Bundles), len(r.Roots))
	for _, b := range r.Bundles {
		fmt.Fprintf(w, "  %s  [%s]\n", b.Path, b.Source)
		for _, u := range b.UUIDs {
			fmt.Fprintf(w, "    %s %s\n", u.UUID, u.Arch)
		}
	}
}
