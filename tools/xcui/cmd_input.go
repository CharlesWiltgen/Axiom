package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"
)

// axeInputVerbs are the AXe subcommands xcui forwards verbatim.
//
// Passthrough, NOT reimplementation: xcui parses none of AXe's flags, so these stay
// flag-compatible as AXe evolves and there is no per-flag surface to keep in sync.
// The point is that input goes through runAxe, which owns the SimulatorKit fallback —
// guidance that says "run `xcui tap`" cannot drift out of that handling the way
// guidance that says "run `axe tap`, and also remember a DEVELOPER_DIR prefix when
// doctor tells you to" can.
//
// Deliberately excluded: describe-ui (xcui reads the tree itself, via describeUI),
// list-simulators (xcui resolves the booted sim), and init (installs AXe's own skill
// files for other tools — nothing to do with driving a simulator).
var axeInputVerbs = map[string]string{
	"tap":          "Tap a point, or locate an element by accessibility and tap it",
	"slider":       "Set a slider to a value from 0 to 100",
	"type":         "Type a sequence of characters",
	"swipe":        "Swipe from one point to another",
	"drag":         "Point-to-point drag using explicit touch move events",
	"button":       "Press a hardware button",
	"key":          "Press a single key by keycode",
	"key-sequence": "Press a sequence of keys by keycode",
	"key-combo":    "Press a key while holding modifiers",
	"touch":        "Touch down/up at specific coordinates",
	"gesture":      "Perform a preset gesture pattern",
	"screenshot":   "Capture the display as a PNG",
}

// inputTimeout bounds a single input verb. Generous: `type` on a long string and
// `gesture` are the slow ones, and a false timeout would look like a flaky tap.
const inputTimeout = 60 * time.Second

// axeVerbRe matches a subcommand line in `axe --help`: EXACTLY two leading spaces,
// then the verb. The exact indent is what separates a verb from a wrapped
// description line, which AXe indents to the description column (~26 spaces).
//
// A looser `\s{2,}…\s{2,}\S` was width-dependent: `axe --help` wraps to the terminal,
// so running it from a pipe rewrapped the text and the pattern matched the stray
// word "capture" off a continuation line while missing `record-video`. Anchor to
// structure, not to whatever width the help happened to wrap at.
var axeVerbRe = regexp.MustCompile(`(?m)^ {2}([a-z][a-z0-9-]*) `)

// unforwardedAxeVerbs reports AXe input verbs xcui does not forward.
//
// The allowlist is static, so a verb AXe adds reads as "unknown command" until an
// Axiom release — the passthrough silently lags the tool it fronts. doctor surfaces
// the drift instead of waiting for a user to hit it. Verbs xcui deliberately owns
// (describe-ui, list-simulators, init) are never reported.
func unforwardedAxeVerbs(axeHelp string) []string {
	// xcui owns these (it reads the tree and resolves the sim itself); the streaming
	// verbs are deliberately left bare because they outlive any request timeout.
	// Neither group is drift, so neither is reported.
	owned := map[string]bool{
		"describe-ui": true, "list-simulators": true, "init": true, "help": true,
		"stream-video": true, "record-video": true,
	}
	// Only the SUBCOMMANDS block: OPTIONS entries share the two-space indent.
	if i := strings.Index(axeHelp, "SUBCOMMANDS:"); i >= 0 {
		axeHelp = axeHelp[i:]
	}
	var missing []string
	for _, m := range axeVerbRe.FindAllStringSubmatch(axeHelp, -1) {
		v := m[1]
		if owned[v] || axeInputVerbs[v] != "" {
			continue
		}
		missing = append(missing, v)
	}
	sort.Strings(missing)
	return missing
}

// runInput forwards an AXe input verb, injecting --udid when the caller omitted it so
// the common single-simulator case needs no bookkeeping. AXe's stdout/stderr and exit
// code pass through unchanged — callers parse AXe's output, not a re-rendering of it.
func runInput(out io.Writer, verb string, args []string) int {
	// Only a LEADING --help is a help request. Scanning all of argv hijacked a
	// literal one — `xcui type -- --help` types the string "--help" into a field —
	// and swallowing the error made `xcui tap --help` exit 0 printing nothing when
	// AXe is not installed.
	if len(args) > 0 && (args[0] == "--help" || args[0] == "-h") {
		res, err := runAxe(context.Background(), inputTimeout, verb, "--help")
		out.Write(res.Stdout)
		os.Stderr.Write(res.Stderr)
		if err != nil {
			fmt.Fprintf(os.Stderr, "xcui %s --help: %v\n", verb, err)
			return 2
		}
		return 0
	}

	ctx := context.Background()
	if !hasFlag(args, "--udid") {
		udid, err := resolveUDID(ctx, "")
		if err != nil {
			fmt.Fprintf(os.Stderr, "xcui %s: %v\n", verb, err)
			return 2
		}
		args = append([]string{"--udid", udid}, args...)
	}

	res, err := runAxe(ctx, inputTimeout, append([]string{verb}, args...)...)
	out.Write(res.Stdout)
	os.Stderr.Write(res.Stderr)
	if err != nil {
		if IsTimeoutError(err) {
			fmt.Fprintf(os.Stderr, "xcui %s: timed out after %s\n", verb, inputTimeout)
			return 2
		}
		// Propagate AXe's own exit code so callers can branch on it exactly as they
		// would running axe directly — the passthrough must be transparent in the
		// failure direction too, not just the success one.
		//
		// Matched on the ExitCode() capability rather than *exec.ExitError concretely:
		// that covers any wrapper the exec layer may grow, and it is constructible in
		// a test, which a real *exec.ExitError is not without spawning a process.
		var coded interface{ ExitCode() int }
		if errors.As(err, &coded) && coded.ExitCode() > 0 {
			return coded.ExitCode()
		}
		return 1
	}
	return 0
}

// hasFlag reports whether args already carries name, in either `--flag value` or
// `--flag=value` form.
func hasFlag(args []string, name string) bool {
	for _, a := range args {
		if a == name || (len(a) > len(name) && a[:len(name)+1] == name+"=") {
			return true
		}
	}
	return false
}
