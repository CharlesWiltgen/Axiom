package main

import (
	"fmt"
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
  xcui dialog accept | dismiss                  Tap the right button on the frontmost system alert
  xcui dialog pregrant <bundle-id> <service>... Grant permissions so no dialog appears
  xcui voiceover traverse                       Emit the computed VoiceOver announcement sequence
  xcui voiceover assert --sequence <file>       Compare the announcement sequence to an expected one
  xcui resize sweep --sizes <WxH,...> [--screenshot-dir <d>] [--assert-id <id>] [--strict]
                                                Drive breakpoints, shoot and assert each (OS 27+)

Input (forwarded to AXe verbatim — same flags, same output, same exit code):
  xcui tap | slider | type | swipe | drag | touch | gesture   Drive the UI
  xcui button | key | key-sequence | key-combo                Hardware buttons and keys
  xcui screenshot                                             Capture the display as PNG

Prefer these over calling 'axe' directly: they inherit xcui's SimulatorKit/
DEVELOPER_DIR handling, so they keep working under an Xcode that AXe cannot load
on its own. Run 'xcui tap --help' to see AXe's own flags for a verb.

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
	case "dialog":
		os.Exit(runDialog(os.Stdout, os.Args[2:]))
	case "voiceover":
		os.Exit(runVoiceOver(os.Stdout, os.Args[2:]))
	case "resize":
		os.Exit(runResize(os.Stdout, os.Args[2:]))
	case "--version", "-v":
		fmt.Println(version)
	case "--help", "-h":
		fmt.Print(usage)
	default:
		// Input verbs forward to AXe. Checked after the named commands so xcui's own
		// verbs always win a name collision with a future AXe subcommand.
		if _, ok := axeInputVerbs[os.Args[1]]; ok {
			os.Exit(runInput(os.Stdout, os.Args[1], os.Args[2:]))
		}
		fmt.Fprintf(os.Stderr, "unknown command: %s\n\n%s", os.Args[1], usage)
		os.Exit(2)
	}
}
