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

Accepts .ips (v1/v2), MetricKit MXCrashDiagnostic JSON, Apple's legacy .crash text format, and Xcode Organizer .xccrashpoint bundles. Auto-detects format; .xccrashpoint bundles are walked to pick the .crash inside (default: Filter_* dir with the most recent modification time, raw .crash not LocallySymbolicated; override with --filter and --prefer-locally-symbolicated).

Run 'xcsym <command> --help' for per-command flags.
`

func main() {
	if len(os.Args) < 2 {
		fmt.Fprint(os.Stderr, usage)
		os.Exit(1)
	}
	switch os.Args[1] {
	case "resolve":
		os.Exit(runResolve(os.Stdout, os.Args[2:]))
	case "verify":
		os.Exit(runVerify(os.Stdout, os.Args[2:]))
	case "crash":
		os.Exit(runCrash(os.Stdout, os.Args[2:]))
	case "find-dsym":
		os.Exit(runFindDsym(os.Stdout, os.Args[2:]))
	case "list-dsyms":
		os.Exit(runListDsyms(os.Stdout, os.Args[2:]))
	case "anonymize":
		os.Exit(runAnonymize(os.Stdout, os.Args[2:]))
	case "--version", "-v":
		fmt.Println(version)
	case "--help", "-h":
		fmt.Print(usage)
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n\n%s", os.Args[1], usage)
		os.Exit(1)
	}
}
