package main

import (
	"fmt"
	"io"
	"os"
)

const version = "0.1.0-dev"

const usage = `xcui — scriptable iOS-simulator UI & accessibility testing for LLMs

Usage:
  xcui doctor [--install]                       Verify AXe/brew/Xcode/booted-sim; --install adds AXe via brew
  xcui wait --for-element <id> | --gone <id> | --idle   Poll the a11y tree until a condition holds
  xcui assert --id <id> [--label <s>] [--value <s>] [--trait <role>] [--single]   Assert on an element
  xcui a11y set --toggle <name> --value <on|off> [--app <bundle-id>]   Set an accessibility setting
  xcui a11y reset                               Clear xcui-set accessibility overrides

Default output is JSON; pass --human for prose. Most verbs auto-resolve the booted
simulator; pass --udid to target a specific one.

Run 'xcui <command> --help' for per-command flags.
`

func main() {
	if len(os.Args) < 2 {
		fmt.Fprint(os.Stderr, usage)
		os.Exit(2)
	}
	switch os.Args[1] {
	case "doctor":
		os.Exit(runDoctor(os.Stdout, os.Args[2:]))
	case "wait":
		os.Exit(runWait(os.Stdout, os.Args[2:]))
	case "assert":
		os.Exit(runAssert(os.Stdout, os.Args[2:]))
	case "a11y":
		os.Exit(runA11y(os.Stdout, os.Args[2:]))
	case "--version", "-v":
		fmt.Println(version)
	case "--help", "-h":
		fmt.Print(usage)
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n\n%s", os.Args[1], usage)
		os.Exit(2)
	}
}

// temporary stubs — replaced per-task below
func runDoctor(out io.Writer, args []string) int { return 0 }
func runWait(out io.Writer, args []string) int   { return 0 }
func runAssert(out io.Writer, args []string) int { return 0 }
func runA11y(out io.Writer, args []string) int   { return 0 }
