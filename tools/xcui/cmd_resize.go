package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// CoreDeviceError codes appResize returns, each meaning something different to a
// caller. Observed live on 2026-08-15; distinguishing them is most of the value
// xcui adds here, because "resize failed" alone sends you debugging the wrong layer.
const (
	errResizeUnsupported  = 1001  // device has no Resizable App Management (pre-27)
	errResizeNoForeground = 24001 // capable, but nothing is running to move
	errResizeNoSession    = 24004 // capable, app running, but no session active
)

// resizeSize is a parsed WxH request.
type resizeSize struct {
	W, H float64
}

func (s resizeSize) String() string { return fmt.Sprintf("%gx%g", s.W, s.H) }

// parseSizes turns "400x900,900x600" into sizes. Rejects the whole list on any bad
// entry rather than silently sweeping a subset — a typo'd breakpoint that quietly
// vanishes from the report is worse than a hard error.
func parseSizes(csv string) ([]resizeSize, error) {
	if strings.TrimSpace(csv) == "" {
		return nil, fmt.Errorf("no sizes given")
	}
	var out []resizeSize
	for _, raw := range strings.Split(csv, ",") {
		part := strings.TrimSpace(raw)
		if part == "" {
			continue
		}
		wh := strings.SplitN(strings.ToLower(part), "x", 2)
		if len(wh) != 2 {
			return nil, fmt.Errorf("size %q is not WxH", part)
		}
		w, err := strconv.ParseFloat(strings.TrimSpace(wh[0]), 64)
		if err != nil || w <= 0 {
			return nil, fmt.Errorf("size %q has a bad width", part)
		}
		h, err := strconv.ParseFloat(strings.TrimSpace(wh[1]), 64)
		if err != nil || h <= 0 {
			return nil, fmt.Errorf("size %q has a bad height", part)
		}
		out = append(out, resizeSize{W: w, H: h})
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("no sizes given")
	}
	return out, nil
}

// appResizeState is the subset of `devicectl device info appResize --json-output -`
// xcui reads back. Sizes arrive as [width, height] NUMBER arrays, not "WxH" strings.
type appResizeState struct {
	CornerRadius float64   `json:"cornerRadius"`
	DisplayName  string    `json:"displayName"`
	DisplayID    string    `json:"displayUniqueId"`
	Preferred    []float64 `json:"preferredSize"`
	MinSize      []float64 `json:"minimumPossibleSize"`
	MaxSize      []float64 `json:"maximumPossibleSize"`
}

// devicectlEnvelope is the common `{result|error, info}` wrapper.
type devicectlEnvelope struct {
	Result json.RawMessage `json:"result"`
	Error  *struct {
		Code   int    `json:"code"`
		Domain string `json:"domain"`
	} `json:"error"`
}

// parseAppResizeInfo pulls the session state out of a devicectl JSON envelope, or
// reports the CoreDeviceError code so the caller can explain the right thing.
func parseAppResizeInfo(raw []byte) (appResizeState, int, error) {
	var env devicectlEnvelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return appResizeState{}, 0, fmt.Errorf("parse appResize info: %w", err)
	}
	if env.Error != nil {
		return appResizeState{}, env.Error.Code, fmt.Errorf("devicectl error %d", env.Error.Code)
	}
	var st appResizeState
	if err := json.Unmarshal(env.Result, &st); err != nil {
		return appResizeState{}, 0, fmt.Errorf("parse appResize result: %w", err)
	}
	return st, 0, nil
}

func sizeOf(pair []float64) string {
	if len(pair) != 2 {
		return ""
	}
	return resizeSize{W: pair[0], H: pair[1]}.String()
}

// actualSizeRe matches the line `start` and `set` print, e.g.
// "  Actual size: 1100.0x550.0".
var actualSizeRe = regexp.MustCompile(`Actual size:\s*([0-9.]+)x([0-9.]+)`)

// parseActualSize reads the effective geometry out of appResize start/set output.
//
// This reads the field devicectl literally labels "Actual", rather than inferring
// from `info appResize`'s preferredSize. The two agreed everywhere they were
// measured on 2026-08-15 — including a 2000x2000 request that "Maximum possible
// size: 1280x1280" did not clamp — but `preferredSize` names the request, and a
// device that DOES clamp (an iPhone 17 turned 1100x500 into 1100x550) is exactly
// the case a sweep exists to catch. Read the labelled field, not the proxy.
func parseActualSize(devicectlOutput string) string {
	m := actualSizeRe.FindStringSubmatch(devicectlOutput)
	if m == nil {
		return ""
	}
	w, err1 := strconv.ParseFloat(m[1], 64)
	h, err2 := strconv.ParseFloat(m[2], 64)
	if err1 != nil || err2 != nil {
		return ""
	}
	return resizeSize{W: w, H: h}.String()
}

// resizeStepReport is one breakpoint's outcome.
type resizeStepReport struct {
	Requested  string   `json:"requested"`
	Actual     string   `json:"actual"`
	Honored    bool     `json:"honored"` // actual == requested
	Screenshot string   `json:"screenshot,omitempty"`
	Matched    int      `json:"matched,omitempty"`
	Pass       bool     `json:"pass"`
	Failures   []string `json:"failures,omitempty"`
}

// ResizeReport is the JSON payload of `xcui resize sweep`.
type ResizeReport struct {
	Tool     string             `json:"tool"`
	Version  string             `json:"version"`
	UDID     string             `json:"udid"`
	AssertID string             `json:"assert_id,omitempty"`
	MinSize  string             `json:"min_size,omitempty"`
	MaxSize  string             `json:"max_size,omitempty"`
	Steps    []resizeStepReport `json:"steps"`
	Clamped  int                `json:"clamped"`
	Pass     bool               `json:"pass"`
	Note     string             `json:"note,omitempty"`
}

func runResize(out io.Writer, args []string) int {
	if len(args) == 0 || args[0] != "sweep" {
		fmt.Fprintln(os.Stderr, "resize: expected 'sweep'")
		return 2
	}
	return runResizeSweep(out, args[1:])
}

func runResizeSweep(out io.Writer, args []string) int {
	fs := flag.NewFlagSet("resize sweep", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	sizesFlag := fs.String("sizes", "", "comma-separated WxH breakpoints, e.g. 400x900,900x600")
	assertID := fs.String("assert-id", "", "accessibility id that must be present at every size")
	corner := fs.Float64("corner-radius", 0, "container corner radius (exercises concentric-corner behavior)")
	settle := fs.Duration("settle", 3*time.Second, "wait after each resize before asserting")
	udidFlag := fs.String("udid", "", "target simulator UDID (default: booted)")
	shotDir := fs.String("screenshot-dir", "", "write a PNG of the Resizable display per size")
	strict := fs.Bool("strict", false, "fail a step whose actual size differs from the requested one")
	human := fs.Bool("human", false, "human-readable output instead of JSON")
	if err := fs.Parse(args); err != nil {
		return 2
	}

	if *shotDir != "" {
		if err := os.MkdirAll(*shotDir, 0o755); err != nil {
			fmt.Fprintln(os.Stderr, "resize sweep:", err)
			return 2
		}
	}

	sizes, err := parseSizes(*sizesFlag)
	if err != nil {
		fmt.Fprintln(os.Stderr, "resize sweep:", err)
		return 2
	}

	ctx := context.Background()
	udid, err := resolveUDID(ctx, *udidFlag)
	if err != nil {
		fmt.Fprintln(os.Stderr, "resize sweep:", err)
		return 2
	}

	// The session lives only as long as `appResize start` runs, so it is held in a
	// background process and killed on every exit path. Leaking it would leave the
	// app parked on the Resizable display for the next run to trip over.
	startArgs := []string{
		"devicectl", "device", "appResize", "start", "-d", udid,
		"--preferred-size", sizes[0].String(),
		"--corner-radius", strconv.FormatFloat(*corner, 'f', -1, 64),
	}
	session := exec.Command("xcrun", startArgs...)
	// os/exec writes the child's output from its own goroutine while this one reads
	// it to parse the Actual size, so the buffer must be guarded — a plain
	// strings.Builder here is a data race that -race catches.
	sessionOut := &syncBuffer{}
	session.Stdout = sessionOut
	session.Stderr = sessionOut
	if err := session.Start(); err != nil {
		fmt.Fprintln(os.Stderr, "resize sweep: could not start session:", err)
		return 2
	}
	endSession := func() {
		if session.Process != nil {
			_ = session.Process.Kill()
			_, _ = session.Process.Wait()
		}
	}
	defer endSession()

	// A bare defer only covers normal returns. Ctrl-C worked by accident of SIGINT
	// reaching the whole process group; a harness that signals just this PID (or any
	// plain `kill`) would leave `appResize start` running forever, stranding the app
	// on the Resizable display — which xcui-ref explicitly promises cannot happen.
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(sig)
	go func() {
		s, ok := <-sig
		if !ok {
			return
		}
		endSession()
		signal.Stop(sig)
		// Re-raise so the caller sees the real cause of death, not exit 0.
		if p, err := os.FindProcess(os.Getpid()); err == nil {
			_ = p.Signal(s)
		}
	}()

	clamped := 0
	rep := ResizeReport{Tool: "xcui", Version: version, UDID: udid, AssertID: *assertID, Pass: true}

	// Wait for the session to come up, then read state back. `start` can take a
	// moment while the display transitions, so poll rather than sleeping once.
	//
	// Readiness requires BOTH the info query to succeed AND `start` to have flushed
	// its geometry block. They are separate processes with no ordering between them:
	// keying only off the info query let step 0 parse an "Actual size" that had not
	// been written yet, yielding Actual:"" and honored:false for a size the device
	// honored — the exact false clamp report this tool exists to prevent.
	var st appResizeState
	deadline := time.Now().Add(20 * time.Second)
	for {
		raw, _ := ExecRun(ctx, 0, "xcrun", "devicectl", "device", "info", "appResize", "-d", udid, "--json-output", "-")
		var code int
		st, code, err = parseAppResizeInfo(raw.Stdout)
		if err == nil && parseActualSize(sessionOut.String()) != "" {
			break
		}
		if err == nil {
			// Session is up but `start` has not printed its geometry yet.
			if time.Now().After(deadline) {
				fmt.Fprintln(os.Stderr, "resize sweep: session started but never reported its actual size within 20s")
				fmt.Fprintln(os.Stderr, strings.TrimSpace(sessionOut.String()))
				return 2
			}
			time.Sleep(200 * time.Millisecond)
			continue
		}
		if msg := explainResizeError(code); msg != "" {
			fmt.Fprintln(os.Stderr, "resize sweep:", msg)
			fmt.Fprintln(os.Stderr, strings.TrimSpace(sessionOut.String()))
			return 2
		}
		if time.Now().After(deadline) {
			fmt.Fprintln(os.Stderr, "resize sweep: session did not become ready within 20s")
			fmt.Fprintln(os.Stderr, strings.TrimSpace(sessionOut.String()))
			return 2
		}
		time.Sleep(500 * time.Millisecond)
	}
	rep.MinSize, rep.MaxSize = sizeOf(st.MinSize), sizeOf(st.MaxSize)

	for i, want := range sizes {
		step := resizeStepReport{Requested: want.String(), Pass: true}

		// Requesting a size does not guarantee getting it — a device may clamp to what
		// its display can host. A sweep that trusted the request would report passing
		// assertions for a breakpoint it never actually exercised, which is the whole
		// failure this primitive exists to prevent.
		if i == 0 {
			// The first size was applied by `start`; its output is already captured.
			step.Actual = parseActualSize(sessionOut.String())
		} else {
			res, err := ExecRun(ctx, 0, "xcrun", "devicectl", "device", "appResize", "set",
				"-d", udid, "--preferred-size", want.String(),
				"--corner-radius", strconv.FormatFloat(*corner, 'f', -1, 64))
			if err != nil {
				rep.Steps = append(rep.Steps, resizeStepReport{
					Requested: want.String(), Pass: false,
					Failures: []string{"appResize set failed: " + err.Error()},
				})
				rep.Pass = false
				continue
			}
			step.Actual = parseActualSize(string(res.Stdout))
		}
		time.Sleep(*settle)
		step.Honored = step.Actual == want.String()

		// An id-presence assertion catches "the element vanished", not the overlap,
		// truncation, and clipping that resizing actually causes. A PNG per breakpoint
		// is what makes a layout regression visible — to a human reviewing CI output
		// or to an assistant iterating on the layout. Captured from the Resizable
		// display specifically, which is where the session moved the app.
		if *shotDir != "" {
			dest := filepath.Join(*shotDir, want.String()+".png")
			shotArgs := []string{"devicectl", "device", "capture", "screenshot", "-d", udid, "--destination", dest}
			if st.DisplayID != "" {
				shotArgs = append(shotArgs, "--display-unique-id", st.DisplayID)
			}
			if _, serr := ExecRun(ctx, 30*time.Second, "xcrun", shotArgs...); serr != nil {
				step.Failures = append(step.Failures, "screenshot failed: "+serr.Error())
				step.Pass = false
			} else {
				step.Screenshot = dest
			}
		}

		if *assertID != "" {
			res, aerr := assertAtSize(ctx, udid, *assertID)
			if aerr != nil {
				step.Pass = false
				step.Failures = append(step.Failures, aerr.Error())
			} else {
				step.Matched = res.Matched
				step.Pass = res.Pass && step.Pass
				step.Failures = append(step.Failures, res.Failures...)
			}
		}

		// A sweep where the device clamped every size still exited 0 if the assertions
		// passed, so an exit-code-only consumer read "all breakpoints validated" for
		// breakpoints never exercised. --strict makes that a failure; either way the
		// clamp is counted and surfaced.
		if !step.Honored {
			clamped++
			if *strict {
				step.Pass = false
				step.Failures = append(step.Failures,
					fmt.Sprintf("requested %s but the device gave %s — this breakpoint was not exercised", want, step.Actual))
			}
		}
		if !step.Pass {
			rep.Pass = false
		}
		rep.Steps = append(rep.Steps, step)
	}

	var notes []string
	if *assertID == "" && *shotDir == "" {
		notes = append(notes, "no --assert-id and no --screenshot-dir: sizes were driven and read back, but nothing was checked")
	}
	if clamped > 0 {
		// Loud even without --strict: silence here is how "all breakpoints validated"
		// gets read off an exit code for breakpoints the device never produced.
		notes = append(notes, fmt.Sprintf(
			"%d of %d requested sizes were clamped by the device — those breakpoints were NOT exercised%s",
			clamped, len(sizes), map[bool]string{true: "", false: " (pass --strict to fail on this)"}[*strict]))
	}
	rep.Clamped = clamped
	rep.Note = strings.Join(notes, "; ")

	if *human {
		renderResizeHuman(out, rep)
	} else if err := json.NewEncoder(out).Encode(rep); err != nil {
		return 8
	}
	if !rep.Pass {
		return 1
	}
	return 0
}

// assertAtSize reads the tree and evaluates the id, retrying once. The automation
// session can time out a single time while the display transitions right after a
// resize — retrying is the difference between a flaky sweep and a trustworthy one.
func assertAtSize(ctx context.Context, udid, id string) (assertResult, error) {
	roots, err := describeUI(ctx, udid)
	if err != nil {
		time.Sleep(2 * time.Second)
		roots, err = describeUI(ctx, udid)
		if err != nil {
			return assertResult{}, fmt.Errorf("describe-ui failed after retry: %w", err)
		}
	}
	return evaluateAssert(roots, assertSpec{id: id}), nil
}

// explainResizeError turns a CoreDeviceError code into the action that fixes it.
// Empty string means "not one of the terminal cases — keep waiting".
func explainResizeError(code int) string {
	switch code {
	case errResizeUnsupported:
		return "this device has no Resizable App Management — free resize needs an OS 27 simulator or device (CoreDeviceError 1001)"
	case errResizeNoForeground:
		return "no foreground app to move to the resizable display — launch your app first, e.g. xcrun simctl launch <udid> <bundle-id> (CoreDeviceError 24001)"
	}
	return ""
}

func renderResizeHuman(out io.Writer, rep ResizeReport) {
	fmt.Fprintf(out, "resize sweep on %s\n", rep.UDID)
	if rep.MinSize != "" || rep.MaxSize != "" {
		fmt.Fprintf(out, "  possible: %s … %s\n", rep.MinSize, rep.MaxSize)
	}
	for _, s := range rep.Steps {
		status := "ok"
		if !s.Pass {
			status = "FAIL"
		}
		actual := s.Actual
		if actual != "" && !s.Honored {
			actual += " (clamped)"
		}
		fmt.Fprintf(out, "  %-12s -> %-18s %s\n", s.Requested, actual, status)
		if s.Screenshot != "" {
			fmt.Fprintf(out, "      shot: %s\n", s.Screenshot)
		}
		for _, f := range s.Failures {
			fmt.Fprintf(out, "      %s\n", f)
		}
	}
	if rep.Note != "" {
		fmt.Fprintf(out, "  note: %s\n", rep.Note)
	}
}

// syncBuffer is an io.Writer safe for concurrent write-by-exec and read-by-caller.
type syncBuffer struct {
	mu  sync.Mutex
	buf strings.Builder
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}
