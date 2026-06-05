package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"math"
	"os"
	"sort"
	"strings"
)

// spokenTraits maps an AXe element type to the trait word VoiceOver appends
// after the label/value. Types absent from the map (StaticText, Application,
// Group, Cell, …) get no trait — the label carries the meaning.
var spokenTraits = map[string]string{
	"Button":          "button",
	"Image":           "image",
	"Link":            "link",
	"TextField":       "text field",
	"SecureTextField": "secure text field",
	"SearchField":     "search field",
	"Switch":          "switch button",
	"Toggle":          "switch button",
	"Slider":          "adjustable",
	"Stepper":         "stepper",
	"Tab":             "tab",
	"CheckBox":        "checkbox",
}

func spokenTrait(el AXElement) string {
	return spokenTraits[el.Type]
}

// isInteractive reports whether the element type carries a spoken trait, i.e.
// VoiceOver focuses it even when it has children.
func isInteractive(el AXElement) bool {
	return spokenTrait(el) != ""
}

// announce renders the computed VoiceOver utterance for one element, in
// VoiceOver speech order: label, value, trait, then "dimmed" when disabled.
// This is a deterministic approximation — not captured audio (TTS is not
// scriptable on the simulator).
func announce(el AXElement) string {
	var parts []string
	if l := buttonLabel(el); l != "" {
		parts = append(parts, l)
	}
	if v := deref(el.AXValue); v != "" {
		parts = append(parts, v)
	}
	if t := spokenTrait(el); t != "" {
		parts = append(parts, t)
	}
	if !el.Enabled {
		parts = append(parts, "dimmed")
	}
	return strings.Join(parts, ", ")
}

// isFocusable approximates the VoiceOver focus set: an announceable element
// that is either a leaf or interactive (containers are skipped — VoiceOver
// lands on their inner elements).
func isFocusable(el AXElement) bool {
	if announce(el) == "" {
		return false
	}
	return len(el.Children) == 0 || isInteractive(el)
}

// rowToleranceY treats elements within this many points vertically as sharing
// a row, so a slightly misaligned row still reads leading-to-trailing.
const rowToleranceY = 8.0

// traverseOrder returns focusable elements in VoiceOver focus order:
// top-to-bottom, then leading-to-trailing within a row.
func traverseOrder(roots []AXElement) []AXElement {
	var els []AXElement
	walk(roots, func(el AXElement) {
		if isFocusable(el) {
			els = append(els, el)
		}
	})
	sort.SliceStable(els, func(i, j int) bool {
		a, b := els[i].Frame, els[j].Frame
		if math.Abs(a.Y-b.Y) > rowToleranceY {
			return a.Y < b.Y
		}
		return a.X < b.X
	})
	return els
}

func announcementSequence(roots []AXElement) []string {
	order := traverseOrder(roots)
	seq := make([]string, 0, len(order))
	for _, el := range order {
		seq = append(seq, announce(el))
	}
	return seq
}

// parseExpectedSequence accepts either a bare JSON array of strings or a saved
// VoiceOverReport object (so `traverse` output round-trips into `assert`).
func parseExpectedSequence(data []byte) ([]string, error) {
	var arr []string
	if err := json.Unmarshal(data, &arr); err == nil {
		return arr, nil
	}
	var rep VoiceOverReport
	if err := json.Unmarshal(data, &rep); err != nil {
		return nil, fmt.Errorf("expected a JSON string array or a voiceover report: %w", err)
	}
	return rep.Sequence, nil
}

// compareSequence returns a human-readable failure per differing position,
// plus a length-mismatch note when the counts differ.
func compareSequence(got, want []string) []string {
	var failures []string
	n := len(got)
	if len(want) < n {
		n = len(want)
	}
	for i := 0; i < n; i++ {
		if got[i] != want[i] {
			failures = append(failures, fmt.Sprintf("[%d] got %q, want %q", i, got[i], want[i]))
		}
	}
	if len(got) != len(want) {
		failures = append(failures, fmt.Sprintf("length: got %d announcements, want %d", len(got), len(want)))
	}
	return failures
}

func runVoiceOver(out io.Writer, args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "voiceover: expected 'traverse' or 'assert'")
		return 2
	}
	switch args[0] {
	case "traverse":
		return runVoiceOverTraverse(out, args[1:])
	case "assert":
		return runVoiceOverAssert(out, args[1:])
	default:
		fmt.Fprintf(os.Stderr, "voiceover: unknown subcommand %q\n", args[0])
		return 2
	}
}

func runVoiceOverTraverse(out io.Writer, args []string) int {
	fs := flag.NewFlagSet("voiceover traverse", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	udidFlag := fs.String("udid", "", "target simulator UDID (default: booted)")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	ctx := context.Background()
	udid, err := resolveUDID(ctx, *udidFlag)
	if err != nil {
		fmt.Fprintln(os.Stderr, "voiceover traverse:", err)
		return 2
	}
	roots, err := describeUI(ctx, udid)
	if err != nil {
		fmt.Fprintln(os.Stderr, "voiceover traverse:", err)
		return 2
	}
	seq := announcementSequence(roots)
	rep := VoiceOverReport{Tool: "xcui", Version: version, Action: "traverse", Count: len(seq), Sequence: seq}
	enc := json.NewEncoder(out)
	if err := enc.Encode(rep); err != nil {
		return 8
	}
	return 0
}

func runVoiceOverAssert(out io.Writer, args []string) int {
	fs := flag.NewFlagSet("voiceover assert", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	seqFile := fs.String("sequence", "", "path to expected announcement JSON (required)")
	udidFlag := fs.String("udid", "", "target simulator UDID (default: booted)")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *seqFile == "" {
		fmt.Fprintln(os.Stderr, "voiceover assert: --sequence <file> is required")
		return 2
	}
	data, err := os.ReadFile(*seqFile)
	if err != nil {
		fmt.Fprintln(os.Stderr, "voiceover assert:", err)
		return 2
	}
	want, err := parseExpectedSequence(data)
	if err != nil {
		fmt.Fprintln(os.Stderr, "voiceover assert:", err)
		return 2
	}

	ctx := context.Background()
	udid, err := resolveUDID(ctx, *udidFlag)
	if err != nil {
		fmt.Fprintln(os.Stderr, "voiceover assert:", err)
		return 2
	}
	roots, err := describeUI(ctx, udid)
	if err != nil {
		fmt.Fprintln(os.Stderr, "voiceover assert:", err)
		return 2
	}
	got := announcementSequence(roots)
	failures := compareSequence(got, want)
	rep := VoiceOverReport{
		Tool: "xcui", Version: version, Action: "assert",
		Count: len(got), Sequence: got, Pass: len(failures) == 0, Failures: failures,
	}
	enc := json.NewEncoder(out)
	if err := enc.Encode(rep); err != nil {
		return 8
	}
	if rep.Pass {
		return 0
	}
	return 1
}
