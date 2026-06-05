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
)

func doctorExitCode(axePresent, simBooted bool) int {
	if axePresent && simBooted {
		return 0
	}
	return 2
}

func runDoctor(out io.Writer, args []string) int {
	fs := flag.NewFlagSet("doctor", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	install := fs.Bool("install", false, "if AXe is missing and brew is present, install it via brew")
	human := fs.Bool("human", false, "human-readable output instead of JSON")
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

	if udid, err := resolveUDID(ctx, ""); err == nil {
		rep.BootedUDID = udid
	} else {
		rep.Problems = append(rep.Problems, "no booted simulator")
		rep.NextSteps = append(rep.NextSteps, "boot a simulator: xcrun simctl boot <device>")
	}

	code := doctorExitCode(axePath != "", rep.BootedUDID != "")
	rep.OK = code == 0

	if *human {
		fmt.Fprintf(out, "AXe: %s\nSim: %s\nOK: %v\n", orNone(rep.AxePath), orNone(rep.BootedUDID), rep.OK)
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
