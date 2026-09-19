package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"time"
)

// doctorExitCode maps the environment to xcui's documented gate: 0 means a caller
// can go straight on to driving the simulator. blocked covers the states where the
// pieces are all present but a device command would still refuse or fail — several
// simulators booted with no --udid, or an AXe that cannot take the tap style xcui
// sends. Reporting those as OK is what makes `xcui doctor && xcui tap …` lie.
func doctorExitCode(axePresent, simBooted, axeWorks, blocked bool) int {
	if axePresent && simBooted && axeWorks && !blocked {
		return 0
	}
	return 2
}

func runDoctor(out io.Writer, args []string) int {
	fs := flag.NewFlagSet("doctor", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	install := fs.Bool("install", false, "if AXe is missing and brew is present, install it via brew")
	human := fs.Bool("human", false, "human-readable output instead of JSON")
	udidFlag := fs.String("udid", "", "report this UDID instead of auto-resolving the booted sim")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	ctx := context.Background()

	rep := DoctorReport{Tool: "xcui", Version: version}
	rep.BrewPath, _ = exec.LookPath("brew")
	if p, err := exec.LookPath("xcode-select"); err == nil {
		if res, e := ExecRun(ctx, 0, p, "-p"); e == nil {
			rep.XcodePath = strings.TrimSpace(string(res.Stdout))
		}
	}

	axePath, _ := exec.LookPath("axe")
	if axePath == "" && *install && rep.BrewPath != "" {
		fmt.Fprintln(os.Stderr, "Installing AXe via Homebrew (cameroncooke/axe/axe)…")
		if _, err := ExecRun(ctx, 300_000_000_000, rep.BrewPath, "install", "cameroncooke/axe/axe"); err != nil {
			rep.Problems = append(rep.Problems, "brew install of AXe failed: "+err.Error())
		} else {
			rep.Installed = true
			axePath, _ = exec.LookPath("axe")
		}
	}
	if axePath != "" {
		rep.AxePath = axePath
		if res, err := ExecRun(ctx, 0, axePath, "--version"); err == nil {
			rep.AxeVersion = strings.TrimSpace(string(res.Stdout))
		}
	} else {
		rep.Problems = append(rep.Problems, "AXe not found on PATH")
		if rep.BrewPath != "" {
			rep.NextSteps = append(rep.NextSteps, "run `xcui doctor --install` (or `brew install cameroncooke/axe/axe`)")
		} else {
			rep.NextSteps = append(rep.NextSteps, "install Homebrew, then `brew install cameroncooke/axe/axe`")
		}
	}

	// smokeUDID is the device the AXe smoke test exercises. It is deliberately
	// separate from rep.BootedUDID: under ambiguity xcui still wants to prove AXe
	// works, but must not advertise a target nothing will drive.
	smokeUDID := ""
	blocked := false
	if udid, booted, err := resolveBootedInfo(ctx, *udidFlag); err == nil {
		smokeUDID = udid
		rep.Booted = booted
		if len(booted) > 1 {
			// Keep this in step with ambiguousSimError in sim.go, which does the refusing.
			blocked = true
			labels := make([]string, len(booted))
			for i, s := range booted {
				labels[i] = fmt.Sprintf("%s %s", s.UDID, simLabel(s))
			}
			rep.Problems = append(rep.Problems, fmt.Sprintf("%d simulators booted (%s) — every device command refuses to run without --udid", len(booted), strings.Join(labels, ", ")))
			rep.NextSteps = append(rep.NextSteps, "pass --udid <udid> on every command to target a specific simulator")
		} else {
			rep.BootedUDID = udid
		}
	} else {
		rep.Problems = append(rep.Problems, "no booted simulator")
		rep.NextSteps = append(rep.NextSteps, "boot a simulator: xcrun simctl boot <device>")
	}

	// Smoke-test AXe: presence + version isn't enough. Under an Xcode that
	// relocated SimulatorKit.framework (Xcode 27 beta), AXe loads but every
	// describe-ui/tap fails — so actually exercise it before green-lighting.
	// Surface passthrough drift: an AXe verb xcui doesn't forward reads as "unknown
	// command", which looks like an xcui bug rather than a version gap.
	if axePath != "" {
		if res, err := ExecRun(ctx, 10*time.Second, axePath, "--help"); err == nil {
			if missing := unforwardedAxeVerbs(string(res.Stdout)); len(missing) > 0 {
				rep.Note = joinNote(rep.Note, "AXe has verbs xcui does not forward ("+strings.Join(missing, ", ")+") — call them as `axe <verb>` until Axiom adds them")
			}
		}
		// xcui supplies --tap-style physical on every tap. If a future AXe drops or
		// renames the flag, each tap fails on an unknown flag; say so here instead.
		if res, err := ExecRun(ctx, 10*time.Second, axePath, "tap", "--help"); err == nil {
			if !tapStyleSupported(string(res.Stdout)) {
				// AXe gained --tap-style in 1.7.0. Older AXe fails every xcui tap and
				// every dialog accept/dismiss on an unknown flag, and describe-ui (the
				// smoke test below) never touches it — so check for it explicitly.
				blocked = true
				rep.Problems = append(rep.Problems, "this AXe ("+orNone(rep.AxeVersion)+") does not offer `axe tap "+tapStyleFlag+"` — xcui requires AXe 1.7.0 or newer; every tap and dialog would fail on an unknown flag")
				rep.NextSteps = append(rep.NextSteps, "upgrade AXe: brew upgrade cameroncooke/axe/axe")
			}
		}
	}

	axeWorks := true
	if axePath != "" && smokeUDID != "" {
		// Read the override AFTER the smoke test, not before: the decision is now
		// made by running AXe, so asking first would always report "none".
		if res, err := runAxe(ctx, 30*time.Second, "describe-ui", "--udid", smokeUDID); err != nil {
			stderr := strings.TrimSpace(string(res.Stderr))
			switch {
			case IsTimeoutError(err):
				// Inconclusive, not a failure: a slow/cold sim can exceed the
				// window without AXe being broken. Leave ok as-is.
				rep.Note = joinNote(rep.Note, "AXe smoke test (describe-ui) timed out — sim may be slow; not treated as a failure")
			case isSimulatorKitLoadError(stderr):
				axeWorks = false
				rep.Problems = append(rep.Problems, "AXe cannot load SimulatorKit.framework — the selected Xcode ("+rep.XcodePath+") relocated it (Xcode 27 beta moved it to Contents/SharedFrameworks) and no fallback Xcode with the legacy path was found")
				rep.NextSteps = append(rep.NextSteps, "install a stable Xcode.app (keeps SimulatorKit at Contents/Developer/Library/PrivateFrameworks), or prefix axe calls with DEVELOPER_DIR=<xcode-with-SimulatorKit>/Contents/Developer")
			default:
				axeWorks = false
				msg := firstLine(stderr)
				if msg == "" {
					msg = err.Error()
				}
				rep.Problems = append(rep.Problems, "AXe smoke test (describe-ui) failed: "+msg)
			}
		} else if dir, on, _ := axeDeveloperDirOverride(); on {
			// Only reachable when a bare AXe run actually failed to load
			// SimulatorKit and the retry under dir succeeded — so the claim that a
			// direct `axe` needs the same prefix is now something xcui observed,
			// not something it inferred from the filesystem and asserted.
			rep.AxeDeveloperDir = dir
			rep.Note = joinNote(rep.Note, "bare AXe could not load SimulatorKit.framework under the selected Xcode; xcui retried with DEVELOPER_DIR="+dir+" and that worked, so it applies the same prefix to its AXe calls")
			rep.NextSteps = append(rep.NextSteps, "for direct axe calls: DEVELOPER_DIR="+dir+" axe <cmd>")
		}
	}

	code := doctorExitCode(axePath != "", smokeUDID != "", axeWorks, blocked)
	rep.OK = code == 0

	if *human {
		fmt.Fprintf(out, "AXe: %s\nSim: %s\nOK: %v\n", orNone(rep.AxePath), orNone(rep.BootedUDID), rep.OK)
		for _, s := range rep.Booted {
			fmt.Fprintf(out, "  booted: %s  %s\n", s.UDID, simLabel(s))
		}
		if rep.Note != "" {
			fmt.Fprintf(out, "  note: %s\n", rep.Note)
		}
		for _, p := range rep.Problems {
			fmt.Fprintf(out, "  problem: %s\n", p)
		}
		return code
	}
	enc := json.NewEncoder(out)
	if err := enc.Encode(rep); err != nil {
		fmt.Fprintf(os.Stderr, "doctor: %v\n", err)
		return 8
	}
	return code
}

func orNone(s string) string {
	if s == "" {
		return "(none)"
	}
	return s
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i]
	}
	return s
}

func joinNote(existing, add string) string {
	if existing == "" {
		return add
	}
	return existing + "; " + add
}
