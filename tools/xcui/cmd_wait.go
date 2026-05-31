package main

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"time"
)

type waitKind int

const (
	waitForElement waitKind = iota
	waitGone
	waitIdle
)

type waitCond struct {
	kind waitKind
	id   string
}

// conditionMet reports whether the tree currently satisfies a non-idle
// condition. (Idle is handled in the loop via tree-hash stability.)
func conditionMet(roots []AXElement, c waitCond) bool {
	switch c.kind {
	case waitForElement:
		return len(findByID(roots, c.id)) > 0
	case waitGone:
		return len(findByID(roots, c.id)) == 0
	}
	return false
}

func treeHash(roots []AXElement) [32]byte {
	b, _ := json.Marshal(roots)
	return sha256.Sum256(b)
}

func runWait(out io.Writer, args []string) int {
	fs := flag.NewFlagSet("wait", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	forEl := fs.String("for-element", "", "wait until an element with this AXUniqueId exists")
	gone := fs.String("gone", "", "wait until no element with this AXUniqueId exists")
	idle := fs.Bool("idle", false, "wait until the a11y tree stops changing")
	timeout := fs.Duration("timeout", 10*time.Second, "max time to wait")
	poll := fs.Duration("poll", 250*time.Millisecond, "poll interval")
	udidFlag := fs.String("udid", "", "target simulator UDID (default: booted)")
	human := fs.Bool("human", false, "human-readable output")
	if err := fs.Parse(args); err != nil {
		return 2
	}

	var cond waitCond
	switch {
	case *forEl != "":
		cond = waitCond{kind: waitForElement, id: *forEl}
	case *gone != "":
		cond = waitCond{kind: waitGone, id: *gone}
	case *idle:
		cond = waitCond{kind: waitIdle}
	default:
		fmt.Fprintln(os.Stderr, "wait: specify one of --for-element, --gone, --idle")
		return 2
	}

	ctx := context.Background()
	udid, err := resolveUDID(ctx, *udidFlag)
	if err != nil {
		fmt.Fprintln(os.Stderr, "wait:", err)
		return 2
	}

	start := time.Now()
	deadline := start.Add(*timeout)
	rep := WaitReport{Tool: "xcui", Version: version, Target: cond.id}
	var lastHash [32]byte
	stableCount := 0

	for {
		rep.Polls++
		roots, derr := describeUI(ctx, udid)
		if derr == nil {
			if cond.kind == waitIdle {
				h := treeHash(roots)
				if h == lastHash {
					stableCount++
					if stableCount >= 2 { // two identical polls in a row
						rep.Met = true
					}
				} else {
					stableCount = 0
					lastHash = h
				}
			} else if conditionMet(roots, cond) {
				rep.Met = true
			}
		}
		if rep.Met || time.Now().After(deadline) {
			break
		}
		time.Sleep(*poll)
	}

	rep.WaitedMS = time.Since(start).Milliseconds()
	switch cond.kind {
	case waitForElement:
		rep.Condition = "for-element"
	case waitGone:
		rep.Condition = "gone"
	case waitIdle:
		rep.Condition = "idle"
	}

	if *human {
		fmt.Fprintf(out, "%s %q met=%v after %dms (%d polls)\n", rep.Condition, rep.Target, rep.Met, rep.WaitedMS, rep.Polls)
	} else {
		enc := json.NewEncoder(out)
		enc.SetIndent("", "  ")
		if err := enc.Encode(rep); err != nil {
			fmt.Fprintf(os.Stderr, "wait: %v\n", err)
			return 8
		}
	}
	if rep.Met {
		return 0
	}
	return 1 // timeout
}
