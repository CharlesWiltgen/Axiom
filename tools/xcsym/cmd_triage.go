package main

import (
	"bufio"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
)

// runTriage implements `xcsym triage [file]`. Reads NormalizedReport JSONL from
// stdin (default) or a file argument; classifies each report (reusing the crash
// rule engine for crashes and the hang engine for hangs); applies noise rules;
// clusters; emits a TriageResult. Network-free: no symbolication, no dSYM
// discovery, no environment capture.
//
// Exit codes:
//
//	0 success (including "some lines skipped as malformed" — see errors[])
//	1 usage error / unreadable stream / invalid flags
//	8 output write error
func runTriage(out io.Writer, args []string) int {
	fs := flag.NewFlagSet("triage", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	latest := fs.String("latest-version", "", "marketing version of the latest shipped build")
	osFloor := fs.String("os-floor", "", "lowest supported OS version")
	minUsers := fs.Int("min-users", 0, "issues below this user count are flagged long_tail (0 disables)")
	if err := fs.Parse(args); err != nil {
		return 1
	}
	var in io.Reader = os.Stdin
	if fs.NArg() == 1 {
		f, err := os.Open(fs.Arg(0))
		if err != nil {
			fmt.Fprintf(os.Stderr, "triage: cannot read %s: %v\n", fs.Arg(0), err)
			return 1
		}
		defer f.Close()
		in = f
	} else if fs.NArg() > 1 {
		fmt.Fprintln(os.Stderr, "triage: at most one file argument (or pipe JSONL on stdin)")
		return 1
	}
	th := Thresholds{LatestVersion: *latest, OSFloor: *osFloor, MinUsers: *minUsers}
	return runTriageCore(out, in, th)
}

// runTriageWithStdin is the test seam: parse flags from args (for thresholds)
// but read reports from the provided reader.
func runTriageWithStdin(out io.Writer, args []string, in io.Reader) int {
	fs := flag.NewFlagSet("triage", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	latest := fs.String("latest-version", "", "")
	osFloor := fs.String("os-floor", "", "")
	minUsers := fs.Int("min-users", 0, "")
	_ = fs.Parse(args)
	th := Thresholds{LatestVersion: *latest, OSFloor: *osFloor, MinUsers: *minUsers}
	return runTriageCore(out, in, th)
}

func runTriageCore(out io.Writer, in io.Reader, th Thresholds) int {
	// Initialize slices so empty output marshals as [] not null (JSON consumers
	// index these). Errors keeps omitempty but is initialized for symmetry.
	res := TriageResult{
		Tool: "xcsym", Subcommand: "triage", Version: version,
		Issues:   []TriageIssue{},
		Clusters: []Cluster{},
		Errors:   []TriageError{},
	}
	// bufio.Reader (not Scanner): Scanner errors out with ErrTooLong on a line
	// past its buffer cap, which would abort the whole corpus run and violate
	// flag-never-hide. ReadBytes grows to any line size; a giant line costs
	// memory but never kills the stream.
	br := bufio.NewReader(in)
	for {
		lineBytes, readErr := br.ReadBytes('\n')
		if line := strings.TrimSpace(string(lineBytes)); line != "" {
			report, err := decodeNormalizedReport([]byte(line))
			if err != nil {
				res.Summary.Skipped++
				res.Errors = append(res.Errors, TriageError{Reason: "malformed JSON: " + err.Error()})
			} else if issue, ok := triageOneReport(report, th); !ok {
				res.Summary.Skipped++
				res.Errors = append(res.Errors, TriageError{IssueID: report.IssueID, Reason: "no frames and frames_unavailable not set; cannot classify"})
			} else {
				res.Issues = append(res.Issues, issue)
				res.Summary.Total++
				if issue.Kind == "hang" {
					res.Summary.Hangs++
				} else {
					res.Summary.Crashes++
				}
				if len(issue.NoiseFlags) > 0 {
					res.Summary.FlaggedNoise++
				}
			}
		}
		if readErr != nil {
			if readErr == io.EOF {
				break
			}
			fmt.Fprintf(os.Stderr, "triage: read input: %v\n", readErr)
			return 1
		}
	}
	res.Clusters = buildClusters(res.Issues)
	res.Summary.Clusters = len(res.Clusters)
	res.Summary.CandidateFamilies = countCandidateFamilies(res.Issues)
	if err := writeJSON(out, "", res); err != nil {
		fmt.Fprintf(os.Stderr, "triage: %v\n", err)
		return 8
	}
	return 0
}

// triageOneReport classifies a single report. Returns (issue, false) when the
// report carries no usable signal (no threads and not flagged frames_unavailable).
func triageOneReport(r *NormalizedReport, th Thresholds) (TriageIssue, bool) {
	if len(r.Threads) == 0 && !r.FramesUnavailable {
		return TriageIssue{}, false
	}
	raw := buildRawCrashFromNormalizedReport(r)
	var cat CategorizeResult
	if r.Kind == "hang" {
		cat = categorizeHang(raw)
	} else {
		cat = Categorize(raw)
	}
	issue := TriageIssue{
		IssueID:           r.IssueID,
		Title:             r.Title,
		Kind:              r.Kind,
		Impact:            r.Impact,
		PatternTag:        cat.Tag,
		PatternConfidence: cat.Confidence,
		RuleID:            cat.RuleID,
		NoiseFlags:        applyNoiseRules(r, raw, cat, th),
		Enrichment:        detectEnrichment(r, raw, cat),
		TopFrames:         topFrameStrings(raw, 5),
	}
	issue.ClusterKey, issue.ClusterConfidence = clusterKey(raw, cat)
	return issue, true
}

func topFrameStrings(raw *RawCrash, n int) []string {
	if raw.CrashedIdx < 0 || raw.CrashedIdx >= len(raw.Threads) {
		return nil
	}
	var out []string
	for i, f := range raw.Threads[raw.CrashedIdx].Frames {
		if i >= n {
			break
		}
		out = append(out, strings.TrimSpace(f.Image+" "+f.Symbol))
	}
	return out
}

// countCandidateFamilies estimates real-bug families: distinct cluster keys
// among issues with no noise flags.
func countCandidateFamilies(issues []TriageIssue) int {
	seen := map[string]bool{}
	for _, is := range issues {
		if len(is.NoiseFlags) == 0 {
			seen[is.ClusterKey] = true
		}
	}
	return len(seen)
}

// Temporary stub for Phase E2. DELETE when detectEnrichment lands in triage_cluster.go.
func detectEnrichment(r *NormalizedReport, raw *RawCrash, cat CategorizeResult) []Enrichment {
	return nil
}
