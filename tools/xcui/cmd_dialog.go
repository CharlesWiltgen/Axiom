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

// alertIntent is what the caller wants done with a frontmost alert.
type alertIntent int

const (
	intentAccept alertIntent = iota
	intentDismiss
)

func parseIntent(s string) (alertIntent, bool) {
	switch s {
	case "accept":
		return intentAccept, true
	case "dismiss":
		return intentDismiss, true
	}
	return 0, false
}

// acceptLabels / dismissLabels are the standard system-button labels for each
// intent, ordered by preference (first present wins). accept prefers the
// most-permissive permission grant. Comparison is apostrophe- and
// case-insensitive (see normalizeLabel), so curly/straight apostrophes match.
var acceptLabels = []string{
	"Allow While Using App",
	"Allow Once",
	"Allow",
	"OK",
	"Open",
	"Continue",
	"Yes",
}

var dismissLabels = []string{
	"Don't Allow",
	"Cancel",
	"Not Now",
	"No",
}

// normalizeLabel folds the typographic apostrophe to ASCII and trims space so
// "Don’t Allow" and "Don't Allow" compare equal.
func normalizeLabel(s string) string {
	return strings.TrimSpace(strings.ReplaceAll(s, "’", "'"))
}

func isButton(el AXElement) bool {
	return el.Type == "Button" || el.Role == "AXButton"
}

// isAlertContainer is true for the alert/sheet node that wraps a system dialog.
func isAlertContainer(el AXElement) bool {
	t := strings.ToLower(el.Type)
	r := strings.ToLower(el.Role)
	return strings.Contains(t, "alert") || strings.Contains(r, "alert") ||
		strings.Contains(t, "sheet") || strings.Contains(r, "sheet")
}

// collectAlertButtons returns the buttons to consider. If the tree contains an
// alert/sheet container, only buttons inside it are returned and inAlert is
// true; otherwise every button is returned with inAlert false (so the
// single-button fallback can't fire on an ordinary screen).
func collectAlertButtons(roots []AXElement) (buttons []AXElement, inAlert bool) {
	var all []AXElement
	var scoped []AXElement
	var rec func(els []AXElement, inside bool)
	rec = func(els []AXElement, inside bool) {
		for _, el := range els {
			here := inside || isAlertContainer(el)
			if isButton(el) {
				all = append(all, el)
				if here {
					scoped = append(scoped, el)
				}
			}
			rec(el.Children, here)
		}
	}
	rec(roots, false)
	if len(scoped) > 0 {
		return scoped, true
	}
	return all, false
}

func buttonLabel(el AXElement) string {
	if l := deref(el.AXLabel); l != "" {
		return l
	}
	return deref(el.Title)
}

// findAlertButton picks the button matching the intent. It prefers a standard
// labelled button; failing that, a one-button alert is tapped for either
// intent. Returns false when no actionable alert button is present.
func findAlertButton(roots []AXElement, intent alertIntent) (AXElement, bool) {
	buttons, inAlert := collectAlertButtons(roots)
	if len(buttons) == 0 {
		return AXElement{}, false
	}
	byLabel := make(map[string]AXElement, len(buttons))
	for _, b := range buttons {
		if lbl := buttonLabel(b); lbl != "" {
			byLabel[strings.ToLower(normalizeLabel(lbl))] = b
		}
	}
	prefs := acceptLabels
	if intent == intentDismiss {
		prefs = dismissLabels
	}
	for _, p := range prefs {
		if b, ok := byLabel[strings.ToLower(normalizeLabel(p))]; ok {
			return b, true
		}
	}
	if inAlert && len(buttons) == 1 {
		return buttons[0], true
	}
	return AXElement{}, false
}

// tapArgs builds the `axe tap` argument vector, preferring the stable
// accessibility id and falling back to the visible label.
func tapArgs(el AXElement, udid string) []string {
	if id := deref(el.AXUniqueID); id != "" {
		return []string{"tap", "--id", id, "--udid", udid}
	}
	return []string{"tap", "--label", buttonLabel(el), "--udid", udid}
}

func runDialog(out io.Writer, args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "dialog: expected 'accept', 'dismiss', or 'pregrant'")
		return 2
	}
	switch args[0] {
	case "accept", "dismiss":
		return runDialogTap(out, args[0], args[1:])
	case "pregrant":
		return runDialogPregrant(out, args[1:])
	default:
		fmt.Fprintf(os.Stderr, "dialog: unknown subcommand %q\n", args[0])
		return 2
	}
}

func runDialogTap(out io.Writer, action string, args []string) int {
	fs := flag.NewFlagSet("dialog "+action, flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	udidFlag := fs.String("udid", "", "target simulator UDID (default: booted)")
	human := fs.Bool("human", false, "human-readable output instead of JSON")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	intent, _ := parseIntent(action)

	ctx := context.Background()
	udid, err := resolveUDID(ctx, *udidFlag)
	if err != nil {
		fmt.Fprintln(os.Stderr, "dialog:", err)
		return 2
	}
	roots, err := describeUI(ctx, udid)
	if err != nil {
		fmt.Fprintln(os.Stderr, "dialog:", err)
		return 2
	}

	rep := DialogReport{Tool: "xcui", Version: version, Action: action}
	btn, ok := findAlertButton(roots, intent)
	if !ok {
		rep.Note = "no actionable alert button found"
		if code := writeDialog(out, rep, *human); code != 0 {
			return code
		}
		return 1
	}
	rep.Button = buttonLabel(btn)
	if _, err := runAxe(ctx, 0, tapArgs(btn, udid)...); err != nil {
		fmt.Fprintln(os.Stderr, "dialog:", err)
		return 2
	}
	rep.Handled = true
	return writeDialog(out, rep, *human)
}

// parsePregrantArgs parses pregrant's flags and positionals in any order.
// Returns the bundle id, services, --udid, --human, and an exit code (0 ok,
// 2 usage error).
func parsePregrantArgs(args []string) (bundle string, services []string, udid string, human bool, code int) {
	fs := flag.NewFlagSet("dialog pregrant", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	udidFlag := fs.String("udid", "", "target simulator UDID (default: booted)")
	humanFlag := fs.Bool("human", false, "human-readable output instead of JSON")
	positionals, err := parseInterspersed(fs, args)
	if err != nil {
		return "", nil, "", false, 2
	}
	if len(positionals) < 2 {
		fmt.Fprintln(os.Stderr, "dialog pregrant: usage: pregrant <bundle-id> <service>... [--udid <udid>]")
		return "", nil, "", false, 2
	}
	return positionals[0], positionals[1:], *udidFlag, *humanFlag, 0
}

func runDialogPregrant(out io.Writer, args []string) int {
	bundle, services, udidFlag, human, code := parsePregrantArgs(args)
	if code != 0 {
		return code
	}

	ctx := context.Background()
	udid, err := resolveUDID(ctx, udidFlag)
	if err != nil {
		fmt.Fprintln(os.Stderr, "dialog pregrant:", err)
		return 2
	}
	rep := DialogReport{Tool: "xcui", Version: version, Action: "pregrant", Bundle: bundle}
	for _, svc := range services {
		if _, err := ExecRun(ctx, 0, "xcrun", "simctl", "privacy", udid, "grant", svc, bundle); err != nil {
			fmt.Fprintf(os.Stderr, "dialog pregrant: grant %q failed: %v\n", svc, err)
			return 2
		}
		rep.Granted = append(rep.Granted, svc)
	}
	rep.Handled = true
	return writeDialog(out, rep, human)
}

// writeDialog emits the report and returns the exit code (0 ok, 8 on
// output-write error — matching the other xcui commands).
func writeDialog(out io.Writer, rep DialogReport, human bool) int {
	if human {
		switch rep.Action {
		case "pregrant":
			fmt.Fprintf(out, "pregrant %s: granted %s\n", rep.Bundle, strings.Join(rep.Granted, ", "))
		default:
			fmt.Fprintf(out, "dialog %s handled=%v button=%q\n", rep.Action, rep.Handled, rep.Button)
		}
		return 0
	}
	enc := json.NewEncoder(out)
	if err := enc.Encode(rep); err != nil {
		fmt.Fprintf(os.Stderr, "dialog: %v\n", err)
		return 8
	}
	return 0
}
