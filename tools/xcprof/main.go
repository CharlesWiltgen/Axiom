package main

import (
	"fmt"
	"os"
)

const version = "0.1.0-dev"

const usage = `xcprof — structured xctrace analysis for LLMs

Usage:
  xcprof doctor [--human]                       Verify xctrace; count instruments/devices
  xcprof analyze <trace> [flags]                Analyze an existing .trace

analyze flags:
  --json                 emit compact JSON (default: terse markdown)
  --both                 emit markdown then compact JSON
  --start-ms / --end-ms  scope analysis to a time window (hang-window workflow)
  --hang-threshold-ms    main-thread gap counted as a candidate stall (default 250)
  --user-binary <names>  comma-separated extra binaries to treat as user code
  --open                 open the trace in Instruments.app after analysis

Output is JSON-compact (LLM-lean) or terse markdown. Phase 1 covers the CPU /
Time Profiler family; memory/network/energy parsing, record, compare, and
cleanup arrive in later phases.
`

func main() {
	if len(os.Args) < 2 {
		fmt.Fprint(os.Stderr, usage)
		os.Exit(2)
	}
	switch os.Args[1] {
	case "doctor":
		os.Exit(runDoctor(os.Stdout, os.Args[2:]))
	case "analyze":
		os.Exit(runAnalyze(os.Stdout, os.Args[2:]))
	case "--version", "-v":
		fmt.Println(version)
	case "--help", "-h":
		fmt.Print(usage)
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n\n%s", os.Args[1], usage)
		os.Exit(2)
	}
}
