package main

import (
	"fmt"
	"os"
)

const version = "0.1.0-dev"

const usage = `xcprof — structured xctrace analysis for LLMs

Usage:
  xcprof doctor [--human]                       Verify xctrace; count instruments/devices
  xcprof record <target> [flags]                Capture a new .trace
  xcprof analyze <trace> [flags]                Analyze an existing .trace

record target (exactly one required):
  --attach <pid|name>    attach to a running process
  --all-processes        system-wide capture (requires --allow-all-processes)
  -- <cmd> [args...]     launch and profile a process (requires --allow-launch)

record flags:
  --preset <name>        cpu / memory / network / energy / full / full-ios (default: cpu)
  --template <name>      record a single Instruments template instead of a preset
  --instrument <name>    add an instrument by name (repeatable; overrides --preset)
  --time-limit <dur>     recording duration, e.g. 30s or 500ms (capped by --max-duration)
  --max-duration <dur>   hard ceiling on duration (default 60s; recording is always bounded)
  --output <path>        .trace path or directory (default: generated under XCPROF_TRACE_ROOT or cwd)
  --no-prompt            skip xctrace privacy prompts (needed for non-interactive use)
  --dry-run              print the planned xctrace command without recording
  --open                 open the trace in Instruments.app after recording
  --human                human-readable output (default: compact JSON)

analyze flags:
  --json                 emit compact JSON (default: terse markdown)
  --both                 emit markdown then compact JSON
  --start-ms / --end-ms  scope analysis to a time window (hang-window workflow)
  --hang-threshold-ms    main-thread gap counted as a candidate stall (default 250)
  --user-binary <names>  comma-separated extra binaries to treat as user code
  --dsym <path>          symbolicate raw-address frames (default: auto-discover by UUID)
  --open                 open the trace in Instruments.app after analysis

Output is JSON-compact (LLM-lean) or terse markdown. Phase 2 covers the CPU
family end to end (record → analyze); memory/network/energy parsing, compare,
and cleanup arrive in later phases.
`

func main() {
	if len(os.Args) < 2 {
		fmt.Fprint(os.Stderr, usage)
		os.Exit(2)
	}
	switch os.Args[1] {
	case "doctor":
		os.Exit(runDoctor(os.Stdout, os.Args[2:]))
	case "record":
		os.Exit(runRecord(os.Stdout, os.Args[2:]))
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
