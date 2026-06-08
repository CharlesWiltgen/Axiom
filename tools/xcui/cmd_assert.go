package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
)

type assertSpec struct {
	id     string
	label  string
	value  string
	trait  string
	single bool
	// presence flags: distinguish "" (unset) from explicit empty.
	hasLabel bool
	hasValue bool
}

type assertResult struct {
	Matched  int
	Pass     bool
	Failures []string
}

// traitMatches accepts a bare word ("button") and matches it against either
// the AX role ("AXButton") or the type ("Button"), case-insensitively.
func traitMatches(el AXElement, trait string) bool {
	t := strings.ToLower(strings.TrimPrefix(trait, "AX"))
	role := strings.ToLower(strings.TrimPrefix(el.Role, "AX"))
	typ := strings.ToLower(el.Type)
	return t == role || t == typ
}

func evaluateAssert(roots []AXElement, spec assertSpec) assertResult {
	matches := findByID(roots, spec.id)
	r := assertResult{Matched: len(matches)}
	if len(matches) == 0 {
		r.Failures = append(r.Failures, fmt.Sprintf("no element with id %q", spec.id))
		return r
	}
	if spec.single && len(matches) != 1 {
		r.Failures = append(r.Failures, fmt.Sprintf("expected exactly 1 element with id %q, found %d", spec.id, len(matches)))
	}
	el := matches[0]
	if spec.hasLabel && deref(el.AXLabel) != spec.label {
		r.Failures = append(r.Failures, fmt.Sprintf("label = %q, want %q", deref(el.AXLabel), spec.label))
	}
	if spec.hasValue && deref(el.AXValue) != spec.value {
		r.Failures = append(r.Failures, fmt.Sprintf("value = %q, want %q", deref(el.AXValue), spec.value))
	}
	if spec.trait != "" && !traitMatches(el, spec.trait) {
		r.Failures = append(r.Failures, fmt.Sprintf("trait %q does not match role %q / type %q", spec.trait, el.Role, el.Type))
	}
	r.Pass = len(r.Failures) == 0
	return r
}

func runAssert(out io.Writer, args []string) int {
	fs := flag.NewFlagSet("assert", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	id := fs.String("id", "", "AXUniqueId of the element to assert on (required)")
	label := fs.String("label", "", "expected AXLabel")
	value := fs.String("value", "", "expected AXValue")
	trait := fs.String("trait", "", "expected trait (e.g. button, image)")
	single := fs.Bool("single", false, "assert the id resolves to exactly one element")
	udidFlag := fs.String("udid", "", "target simulator UDID (default: booted)")
	human := fs.Bool("human", false, "human-readable output instead of JSON")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *id == "" {
		fmt.Fprintln(os.Stderr, "assert: --id is required")
		return 2
	}
	spec := assertSpec{id: *id, label: *label, value: *value, trait: *trait, single: *single}
	fs.Visit(func(f *flag.Flag) {
		if f.Name == "label" {
			spec.hasLabel = true
		}
		if f.Name == "value" {
			spec.hasValue = true
		}
	})

	ctx := context.Background()
	udid, err := resolveUDID(ctx, *udidFlag)
	if err != nil {
		fmt.Fprintln(os.Stderr, "assert:", err)
		return 2
	}
	roots, err := describeUI(ctx, udid)
	if err != nil {
		fmt.Fprintln(os.Stderr, "assert:", err)
		return 2
	}

	res := evaluateAssert(roots, spec)
	rep := AssertReport{Tool: "xcui", Version: version, ID: *id, Matched: res.Matched, Pass: res.Pass, Failures: res.Failures}
	if *human {
		fmt.Fprintf(out, "assert id=%q pass=%v\n", *id, res.Pass)
		for _, f := range res.Failures {
			fmt.Fprintf(out, "  - %s\n", f)
		}
	} else {
		enc := json.NewEncoder(out)
		if err := enc.Encode(rep); err != nil {
			fmt.Fprintf(os.Stderr, "assert: %v\n", err)
			return 8
		}
	}
	if res.Pass {
		return 0
	}
	return 1
}
