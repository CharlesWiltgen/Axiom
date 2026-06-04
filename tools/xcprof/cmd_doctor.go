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

// countListLines counts non-empty, non-header lines from `xctrace list`
// output (the first line is a "== … ==" header).
func countListLines(stdout []byte) int {
	n := 0
	for _, line := range strings.Split(string(stdout), "\n") {
		t := strings.TrimSpace(line)
		if t == "" || strings.HasPrefix(t, "==") {
			continue
		}
		n++
	}
	return n
}

func runDoctor(out io.Writer, args []string) int {
	fs := flag.NewFlagSet("doctor", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	human := fs.Bool("human", false, "human-readable output")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	ctx := context.Background()
	rep := DoctorReport{Tool: "xcprof", Version: version}

	verRes, err := ExecRun(ctx, 0, "xcrun", "xctrace", "version")
	if err != nil {
		rep.Problems = append(rep.Problems, "xctrace not available: "+err.Error())
	} else {
		rep.XctraceVersion = strings.TrimSpace(string(verRes.Stdout))
		if p, perr := ExecRun(ctx, 0, "xcrun", "--find", "xctrace"); perr == nil {
			rep.XctracePath = strings.TrimSpace(string(p.Stdout))
		}
		if inst, ierr := ExecRun(ctx, 0, "xcrun", "xctrace", "list", "instruments"); ierr == nil {
			rep.Instruments = countListLines(inst.Stdout)
		}
		if dev, derr := ExecRun(ctx, 0, "xcrun", "xctrace", "list", "devices"); derr == nil {
			rep.Devices = countListLines(dev.Stdout)
		}
	}
	rep.OK = len(rep.Problems) == 0

	if *human {
		fmt.Fprintf(out, "xcprof doctor ok=%v\n", rep.OK)
		if rep.XctraceVersion != "" {
			fmt.Fprintf(out, "  xctrace: %s (%s)\n", rep.XctraceVersion, rep.XctracePath)
			fmt.Fprintf(out, "  instruments: %d · devices: %d\n", rep.Instruments, rep.Devices)
		}
		for _, p := range rep.Problems {
			fmt.Fprintf(out, "  - %s\n", p)
		}
	} else {
		enc := json.NewEncoder(out) // compact
		if err := enc.Encode(rep); err != nil {
			fmt.Fprintln(os.Stderr, "doctor: write output:", err)
		}
	}
	if rep.OK {
		return 0
	}
	return 2
}
