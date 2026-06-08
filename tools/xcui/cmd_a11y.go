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

type toggleMethod int

const (
	methodDefaults         toggleMethod = iota
	methodContentSize                   // simctl ui <udid> content_size <value-as-is>
	methodIncreaseContrast              // simctl ui <udid> increase_contrast <enabled|disabled>
)

type toggleSpec struct {
	method   toggleMethod
	key      string // defaults key (methodDefaults only)
	relaunch bool
}

// toggleTable maps the public toggle name to how to apply it. Every entry was
// confirmed live against the booted simulator during the Task-8 spike:
//   - reduce-motion / reduce-transparency: keys iOS itself populates in the
//     com.apple.Accessibility domain (write + readback verified); need relaunch.
//   - increase-contrast: native `simctl ui increase_contrast enabled|disabled`
//     (supersedes the defaults `DarkenSystemColors` candidate); applies live.
//   - dynamic-type: native `simctl ui content_size <size>`; applies live.
//
// The voiceover / differentiate-without-color / bold-text candidates were NOT
// confirmable (absent from the domain, no native simctl ui setter) and are
// intentionally omitted from v1 — see xcui-ref.md.
var toggleTable = map[string]toggleSpec{
	"reduce-motion":       {method: methodDefaults, key: "ReduceMotionEnabled", relaunch: true},
	"reduce-transparency": {method: methodDefaults, key: "ReduceTransparencyEnabled", relaunch: true},
	"increase-contrast":   {method: methodIncreaseContrast, relaunch: false},
	"dynamic-type":        {method: methodContentSize, relaunch: false},
}

func lookupToggle(name string) (toggleSpec, bool) {
	t, ok := toggleTable[name]
	return t, ok
}

func parseOnOff(s string) (bool, error) {
	switch strings.ToLower(s) {
	case "on", "true", "1", "yes":
		return true, nil
	case "off", "false", "0", "no":
		return false, nil
	}
	return false, fmt.Errorf("invalid on/off value %q", s)
}

// contrastArg maps an on/off bool to the simctl ui increase_contrast argument.
func contrastArg(on bool) string {
	if on {
		return "enabled"
	}
	return "disabled"
}

func runA11y(out io.Writer, args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "a11y: expected 'set' or 'reset'")
		return 2
	}
	switch args[0] {
	case "set":
		return runA11ySet(out, args[1:])
	case "reset":
		return runA11yReset(out, args[1:])
	default:
		fmt.Fprintf(os.Stderr, "a11y: unknown subcommand %q\n", args[0])
		return 2
	}
}

func runA11ySet(out io.Writer, args []string) int {
	fs := flag.NewFlagSet("a11y set", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	toggle := fs.String("toggle", "", "setting name (e.g. reduce-motion, dynamic-type)")
	value := fs.String("value", "", "on|off, or a content_size for dynamic-type")
	app := fs.String("app", "", "bundle id to relaunch so the setting takes effect")
	udidFlag := fs.String("udid", "", "target simulator UDID (default: booted)")
	human := fs.Bool("human", false, "human-readable output instead of JSON")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *toggle == "" || *value == "" {
		fmt.Fprintln(os.Stderr, "a11y set: --toggle and --value are required")
		return 2
	}
	spec, ok := lookupToggle(*toggle)
	if !ok {
		fmt.Fprintf(os.Stderr, "a11y set: unknown toggle %q\n", *toggle)
		return 2
	}

	ctx := context.Background()
	udid, err := resolveUDID(ctx, *udidFlag)
	if err != nil {
		fmt.Fprintln(os.Stderr, "a11y set:", err)
		return 2
	}

	rep := A11yReport{Tool: "xcui", Version: version, Toggle: *toggle, Value: *value}

	switch spec.method {
	case methodContentSize:
		if _, err := ExecRun(ctx, 0, "xcrun", "simctl", "ui", udid, "content_size", *value); err != nil {
			fmt.Fprintln(os.Stderr, "a11y set:", err)
			return 2
		}
	case methodIncreaseContrast:
		b, perr := parseOnOff(*value)
		if perr != nil {
			fmt.Fprintln(os.Stderr, "a11y set:", perr)
			return 2
		}
		if _, err := ExecRun(ctx, 0, "xcrun", "simctl", "ui", udid, "increase_contrast", contrastArg(b)); err != nil {
			fmt.Fprintln(os.Stderr, "a11y set:", err)
			return 2
		}
	case methodDefaults:
		b, perr := parseOnOff(*value)
		if perr != nil {
			fmt.Fprintln(os.Stderr, "a11y set:", perr)
			return 2
		}
		boolStr := "false"
		if b {
			boolStr = "true"
		}
		if _, err := ExecRun(ctx, 0, "xcrun", "simctl", "spawn", udid, "defaults", "write", "com.apple.Accessibility", spec.key, "-bool", boolStr); err != nil {
			fmt.Fprintln(os.Stderr, "a11y set:", err)
			return 2
		}
	}
	rep.Applied = true

	if spec.relaunch && *app != "" {
		_, _ = ExecRun(ctx, 0, "xcrun", "simctl", "terminate", udid, *app)
		if _, err := ExecRun(ctx, 0, "xcrun", "simctl", "launch", udid, *app); err == nil {
			rep.Relaunched = true
		}
	} else if spec.relaunch {
		rep.Note = "setting written but no --app given; relaunch the app for it to take effect"
	}

	if *human {
		renderA11yHuman(out, rep)
		return 0
	}
	enc := json.NewEncoder(out)
	if err := enc.Encode(rep); err != nil {
		fmt.Fprintf(os.Stderr, "a11y set: %v\n", err)
		return 8
	}
	return 0
}

func runA11yReset(out io.Writer, args []string) int {
	fs := flag.NewFlagSet("a11y reset", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	udidFlag := fs.String("udid", "", "target simulator UDID (default: booted)")
	human := fs.Bool("human", false, "human-readable output instead of JSON")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	ctx := context.Background()
	udid, err := resolveUDID(ctx, *udidFlag)
	if err != nil {
		fmt.Fprintln(os.Stderr, "a11y reset:", err)
		return 2
	}
	for _, spec := range toggleTable {
		if spec.method == methodDefaults {
			_, _ = ExecRun(ctx, 0, "xcrun", "simctl", "spawn", udid, "defaults", "delete", "com.apple.Accessibility", spec.key)
		}
	}
	_, _ = ExecRun(ctx, 0, "xcrun", "simctl", "ui", udid, "content_size", "large")
	_, _ = ExecRun(ctx, 0, "xcrun", "simctl", "ui", udid, "increase_contrast", "disabled")
	rep := A11yReport{Tool: "xcui", Version: version, Applied: true, Note: "accessibility overrides cleared"}
	if *human {
		renderA11yHuman(out, rep)
		return 0
	}
	enc := json.NewEncoder(out)
	if err := enc.Encode(rep); err != nil {
		return 8
	}
	return 0
}
