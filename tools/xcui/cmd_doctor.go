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

func doctorExitCode(axePresent, simBooted, axeWorks bool) int {
	if axePresent && simBooted && axeWorks {
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

	if udid, booted, err := resolveBootedInfo(ctx, *udidFlag); err == nil {
		rep.BootedUDID = udid
		if len(booted) > 1 {
			rep.Note = fmt.Sprintf("%d simulators booted (%s) — xcui targets %s; pass --udid to pick another", len(booted), strings.Join(booted, ", "), udid)
			rep.NextSteps = append(rep.NextSteps, "pass --udid <udid> to target a specific simulator")
		}
	} else {
		rep.Problems = append(rep.Problems, "no booted simulator")
		rep.NextSteps = append(rep.NextSteps, "boot a simulator: xcrun simctl boot <device>")
	}

	// Smoke-test AXe: presence + version isn't enough. Under an Xcode that
	// relocated SimulatorKit.framework (Xcode 27 beta), AXe loads but every
	// describe-ui/tap fails — so actually exercise it before green-lighting.
	axeWorks := true
	if axePath != "" && rep.BootedUDID != "" {
		if dir, on := axeDeveloperDirOverride(); on {
			rep.AxeDeveloperDir = dir
		}
		if res, err := runAxe(ctx, 30*time.Second, "describe-ui", "--udid", rep.BootedUDID); err != nil {
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
		} else if rep.AxeDeveloperDir != "" {
			// xcui compensates on its own AXe calls, but a bare `axe` (e.g. an
			// `axe tap` run directly) still needs the same DEVELOPER_DIR prefix.
			rep.Note = joinNote(rep.Note, "selected Xcode relocated SimulatorKit.framework; xcui auto-applies DEVELOPER_DIR="+rep.AxeDeveloperDir+" to its AXe calls — bare `axe` fails without the same prefix")
			rep.NextSteps = append(rep.NextSteps, "for direct axe calls: DEVELOPER_DIR="+rep.AxeDeveloperDir+" axe <cmd>")
		}
	}

	code := doctorExitCode(axePath != "", rep.BootedUDID != "", axeWorks)
	rep.OK = code == 0

	if *human {
		fmt.Fprintf(out, "AXe: %s\nSim: %s\nOK: %v\n", orNone(rep.AxePath), orNone(rep.BootedUDID), rep.OK)
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
