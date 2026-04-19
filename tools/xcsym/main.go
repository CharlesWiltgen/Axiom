package main

import (
	"fmt"
	"os"
)

const version = "0.1.0-dev"

const usage = `xcsym — iOS/macOS crash symbolication and analysis for LLMs

Usage:
  xcsym crash <file>         Full pipeline: parse, discover dSYMs, symbolicate, categorize
  xcsym resolve <addr>...    Resolve address(es) against a dSYM
  xcsym find-dsym <uuid>     Locate dSYM by UUID
  xcsym list-dsyms           Inventory known dSYMs
  xcsym verify <file>        Verify UUID and arch match per image
  xcsym anonymize <file>     Strip PII from a crash file for fixture use

Accepts .ips (v1/v2) and MetricKit MXCrashDiagnostic JSON. Auto-detects format.

Run 'xcsym <command> --help' for per-command flags.
`

func main() {
	if len(os.Args) < 2 {
		fmt.Fprint(os.Stderr, usage)
		os.Exit(1)
	}
	switch os.Args[1] {
	case "crash", "resolve", "find-dsym", "list-dsyms", "verify", "anonymize":
		fmt.Fprintf(os.Stderr, "not implemented yet: %s\n", os.Args[1])
		os.Exit(1)
	case "--version", "-v":
		fmt.Println(version)
	case "--help", "-h":
		fmt.Print(usage)
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n\n%s", os.Args[1], usage)
		os.Exit(1)
	}
}
