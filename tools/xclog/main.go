package main

import (
	"bufio"
	"bytes"
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

const usage = `xclog — capture iOS console output for LLMs and humans

Usage:
  xclog launch <bundle-id> [options]    Launch simulator app and capture all output
  xclog attach <name-or-pid> [options]  Attach to running process (os_log only)
  xclog show <name-or-pid> [options]    Show recent logs (post-mortem analysis)
  xclog list [options]                  List installed apps on simulator

Output is JSON lines by default (optimized for LLM consumption).

Options:
  --device <udid>         Simulator UDID (default: "booted")
  --device-udid <udid>    Physical device UDID (for show command)
  --output <file>         Write to file (in addition to stdout)
  --human                 Human-readable colored output instead of JSON
  --no-color              Disable colors (--human mode only)
  --filter <regex>        Filter output lines by regex pattern
  --subsystem <name>      Filter os_log by subsystem
  --max-lines <n>         Stop after n lines (default: 0 = unlimited)
  --timeout <duration>    Stop after duration (e.g. "30s", "5m")
  --last <duration>       How far back to search (show command, default: "5m")

Examples:
  xclog launch com.example.MyApp --timeout 30s --max-lines 100
  xclog attach MyApp --filter "error|warning"
  xclog show MyApp --last 10m --filter "(?i)error"
  xclog show MyApp --device-udid 00001234-... --last 5m
  xclog list

Coverage:
  launch mode captures print(), debugPrint(), NSLog(), os_log(), Logger (simulator)
  attach mode captures NSLog(), os_log(), Logger (simulator, NOT print/debugPrint)
  show   mode captures NSLog(), os_log(), Logger (simulator + physical device)
`

// Source identifies where a log line originated.
type Source int

const (
	SourceStdout Source = iota
	SourceStderr
	SourceOSLog
)

func (s Source) Tag() string {
	switch s {
	case SourceStdout:
		return "print"
	case SourceStderr:
		return "stderr"
	case SourceOSLog:
		return "os_log"
	default:
		return "unknown"
	}
}

func (s Source) Color() string {
	switch s {
	case SourceStdout:
		return "\033[36m" // cyan
	case SourceStderr:
		return "\033[33m" // yellow
	case SourceOSLog:
		return "\033[35m" // magenta
	default:
		return ""
	}
}

// LogLine is a single captured log entry.
type LogLine struct {
	Time      time.Time
	Source    Source
	Level     string // os_log messageType: Debug, Default, Info, Error, Fault
	Subsystem string
	Category  string
	Process   string
	PID       int
	Text      string
}

// Config holds all CLI options.
type Config struct {
	Device     string
	DeviceUDID string // physical device UDID
	Output     string
	Human      bool
	NoColor    bool
	Filter     string
	Subsystem  string
	MaxLines   int
	Timeout    time.Duration
	Last       string // duration string for show command (e.g. "5m")

	filterRe *regexp.Regexp // compiled eagerly in main(); read-only at runtime
}

// subsystemRe validates subsystem names (reverse-DNS identifiers).
var subsystemRe = regexp.MustCompile(`^[\w.-]+$`)

// deviceUDIDRe validates Apple device UDIDs (hyphenated or plain hex).
var deviceUDIDRe = regexp.MustCompile(`^[0-9A-Fa-f-]{16,50}$`)

// lastDurationRe validates log duration format (e.g. "5m", "2h", "1d").
var lastDurationRe = regexp.MustCompile(`^\d+[mhd]$`)

// osLogEntry is a single entry from `log` ndjson output.
type osLogEntry struct {
	Timestamp        string `json:"timestamp"`
	EventMessage     string `json:"eventMessage"`
	MessageType      string `json:"messageType"`
	Subsystem        string `json:"subsystem"`
	Category         string `json:"category"`
	ProcessID        int    `json:"processID"`
	ProcessImagePath string `json:"processImagePath"`
}

// jsonOutputLine is the JSON output format for LLM consumption.
type jsonOutputLine struct {
	Time      string `json:"time"`
	Source    string `json:"source"`
	Level     string `json:"level,omitempty"`
	Subsystem string `json:"subsystem,omitempty"`
	Category  string `json:"category,omitempty"`
	Process   string `json:"process,omitempty"`
	PID       int    `json:"pid,omitempty"`
	Text      string `json:"text"`
}

// appInfo is the JSON output format for the list subcommand.
type appInfo struct {
	BundleID string `json:"bundle_id"`
	Name     string `json:"name"`
	Version  string `json:"version,omitempty"`
}

const osLogTimeLayout = "2006-01-02 15:04:05.000000-0700"

// formatJSON serializes a LogLine as a JSON line with a trailing newline.
func formatJSON(line LogLine) []byte {
	j := jsonOutputLine{
		Time:      line.Time.Format("15:04:05.000"),
		Source:    line.Source.Tag(),
		Level:     strings.ToLower(line.Level),
		Subsystem: line.Subsystem,
		Category:  line.Category,
		Process:   line.Process,
		PID:       line.PID,
		Text:      line.Text,
	}
	b, _ := json.Marshal(j)
	return append(b, '\n')
}

// matchesFilter checks if text matches the configured filter regex.
// Returns true if no filter is configured. filterRe must be compiled before use.
func matchesFilter(text string, cfg *Config) bool {
	if cfg.filterRe == nil {
		return true
	}
	return cfg.filterRe.MatchString(text)
}

// processName extracts the binary name from a full image path.
func processName(imagePath string) string {
	if i := strings.LastIndex(imagePath, "/"); i >= 0 {
		return imagePath[i+1:]
	}
	return imagePath
}

func registerFlags(fs *flag.FlagSet, cfg *Config) {
	fs.StringVar(&cfg.Device, "device", "booted", "Simulator UDID")
	fs.StringVar(&cfg.DeviceUDID, "device-udid", "", "Physical device UDID (show command)")
	fs.StringVar(&cfg.Output, "output", "", "Write to file")
	fs.BoolVar(&cfg.Human, "human", false, "Human-readable colored output")
	fs.BoolVar(&cfg.NoColor, "no-color", false, "Disable colors (--human mode)")
	fs.StringVar(&cfg.Filter, "filter", "", "Filter output by regex")
	fs.StringVar(&cfg.Subsystem, "subsystem", "", "Filter os_log by subsystem")
	fs.IntVar(&cfg.MaxLines, "max-lines", 0, "Stop after n lines (0 = unlimited)")
	fs.DurationVar(&cfg.Timeout, "timeout", 0, "Stop after duration (e.g. 30s, 5m)")
	fs.StringVar(&cfg.Last, "last", "5m", "How far back to search (show command)")
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprint(os.Stderr, usage)
		os.Exit(1)
	}

	subcmd := os.Args[1]

	// list doesn't require a target argument
	if subcmd == "list" {
		cfg := Config{}
		fs := flag.NewFlagSet("list", flag.ExitOnError)
		registerFlags(fs, &cfg)
		fs.Parse(os.Args[2:])
		runList(&cfg)
		return
	}

	if len(os.Args) < 3 {
		fmt.Fprint(os.Stderr, usage)
		os.Exit(1)
	}

	target := os.Args[2]

	cfg := Config{}
	fs := flag.NewFlagSet(subcmd, flag.ExitOnError)
	registerFlags(fs, &cfg)
	fs.Parse(os.Args[3:])

	// Compile filter regex eagerly — fail fast, read-only at runtime (no race)
	if cfg.Filter != "" {
		var err error
		cfg.filterRe, err = regexp.Compile(cfg.Filter)
		if err != nil {
			fatal("invalid filter regex %q: %v", cfg.Filter, err)
		}
	}

	// Validate subsystem to prevent NSPredicate injection
	if cfg.Subsystem != "" && !subsystemRe.MatchString(cfg.Subsystem) {
		fatal("invalid subsystem %q: must be a reverse-DNS identifier (e.g. com.example.MyApp)", cfg.Subsystem)
	}

	// Validate device UDID format
	if cfg.DeviceUDID != "" && !deviceUDIDRe.MatchString(cfg.DeviceUDID) {
		fatal("invalid --device-udid %q: must be a device UDID (e.g. 00001234-000A1234AB1234CD)", cfg.DeviceUDID)
	}

	// Validate --last duration format for show command
	if subcmd == "show" && !lastDurationRe.MatchString(cfg.Last) {
		fatal("invalid --last %q: must be a duration like 5m, 2h, or 1d", cfg.Last)
	}

	var out io.Writer = os.Stdout
	if cfg.Output != "" {
		f, err := os.Create(cfg.Output)
		if err != nil {
			fatal("cannot create output file: %v", err)
		}
		defer f.Close()
		out = io.MultiWriter(os.Stdout, f)
		fmt.Fprintf(os.Stderr, "Writing to %s\n", cfg.Output)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Apply --timeout if set
	if cfg.Timeout > 0 {
		ctx, cancel = context.WithTimeout(ctx, cfg.Timeout)
		defer cancel()
	}

	switch subcmd {
	case "launch":
		runLaunch(ctx, cancel, target, &cfg, out)
	case "attach":
		runAttach(ctx, cancel, target, &cfg, out)
	case "show":
		runShow(target, &cfg, out)
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n\n", subcmd)
		fmt.Fprint(os.Stderr, usage)
		os.Exit(1)
	}
}

func runList(cfg *Config) {
	// Get plist from simctl
	simctlOut, err := exec.Command("xcrun", "simctl", "listapps", cfg.Device).Output()
	if err != nil {
		fatal("simctl listapps failed: %v", err)
	}

	// Convert plist to JSON via plutil
	cmd := exec.Command("plutil", "-convert", "json", "-o", "-", "-")
	cmd.Stdin = bytes.NewReader(simctlOut)
	jsonOut, err := cmd.Output()
	if err != nil {
		fatal("plutil conversion failed: %v", err)
	}

	// Parse the top-level dict: bundle_id -> app info
	var apps map[string]map[string]interface{}
	if err := json.Unmarshal(jsonOut, &apps); err != nil {
		fatal("cannot parse app list: %v", err)
	}

	enc := json.NewEncoder(os.Stdout)
	for bundleID, info := range apps {
		name, _ := info["CFBundleDisplayName"].(string)
		if name == "" {
			name, _ = info["CFBundleName"].(string)
		}
		version, _ := info["CFBundleShortVersionString"].(string)
		enc.Encode(appInfo{
			BundleID: bundleID,
			Name:     name,
			Version:  version,
		})
	}
}

func runLaunch(ctx context.Context, cancel context.CancelFunc, bundleID string, cfg *Config, out io.Writer) {
	lines := make(chan LogLine, 256)
	var wg sync.WaitGroup
	var cmds []*exec.Cmd

	// Single-phase launch: --console gives us stdout/stderr AND prints "bundle.id: PID" first
	simctlArgs := []string{
		"simctl", "launch", "--console", "--terminate-running-process",
		cfg.Device, bundleID,
	}
	simctl := exec.CommandContext(ctx, "xcrun", simctlArgs...)
	cmds = append(cmds, simctl)

	stdout, err := simctl.StdoutPipe()
	if err != nil {
		fatal("simctl stdout pipe: %v", err)
	}
	stderr, err := simctl.StderrPipe()
	if err != nil {
		fatal("simctl stderr pipe: %v", err)
	}
	if err := simctl.Start(); err != nil {
		fatal("simctl launch --console failed: %v", err)
	}

	// Parse PID from first line of --console stdout: "com.example.App: 12345"
	stdoutReader := bufio.NewReader(stdout)
	appPID := 0
	firstLine, err := stdoutReader.ReadString('\n')
	if err == nil {
		if parts := strings.SplitN(strings.TrimSpace(firstLine), ":", 2); len(parts) == 2 {
			if pid, err := strconv.Atoi(strings.TrimSpace(parts[1])); err == nil {
				appPID = pid
				fmt.Fprintf(os.Stderr, "Launched %s (PID %d) on %s\n", bundleID, appPID, cfg.Device)
			}
		}
	}
	if appPID == 0 {
		fatal("could not parse PID from simctl output: %s", strings.TrimSpace(firstLine))
	}

	// Stream stdout (print/debugPrint)
	wg.Add(1)
	go func() {
		defer wg.Done()
		streamLines(stdoutReader, SourceStdout, lines, cfg)
	}()

	// Stream stderr (NSLog)
	wg.Add(1)
	go func() {
		defer wg.Done()
		streamLines(stderr, SourceStderr, lines, cfg)
	}()

	// Start log stream with ndjson for structured os_log data
	predicate := fmt.Sprintf("processIdentifier == %d", appPID)
	if cfg.Subsystem != "" {
		predicate = fmt.Sprintf("processIdentifier == %d AND subsystem == '%s'", appPID, cfg.Subsystem)
	}
	logCmd := exec.CommandContext(ctx, "log", "stream",
		"--level", "debug",
		"--style", "ndjson",
		"--predicate", predicate,
	)
	cmds = append(cmds, logCmd)

	logStdout, err := logCmd.StdoutPipe()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Warning: log stream pipe failed: %v (os_log unavailable)\n", err)
	} else if err := logCmd.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "Warning: log stream failed: %v (os_log unavailable)\n", err)
	} else {
		fmt.Fprintf(os.Stderr, "Streaming os_log (PID %d)\n", appPID)
		wg.Add(1)
		go func() {
			defer wg.Done()
			streamOSLogNDJSON(logStdout, lines, cfg)
		}()
	}

	fmt.Fprintf(os.Stderr, "---\n")

	go func() {
		wg.Wait()
		cancel()
	}()

	writeLines(ctx, lines, cfg, out)
	cleanup(cmds)
}

func runAttach(ctx context.Context, cancel context.CancelFunc, target string, cfg *Config, out io.Writer) {
	lines := make(chan LogLine, 256)
	var wg sync.WaitGroup

	predicate := ""
	if pid, err := strconv.Atoi(target); err == nil {
		predicate = fmt.Sprintf("processIdentifier == %d", pid)
		fmt.Fprintf(os.Stderr, "Attaching to PID %d\n", pid)
	} else {
		predicate = fmt.Sprintf("process == %q", target)
		fmt.Fprintf(os.Stderr, "Attaching to process %q\n", target)
	}

	if cfg.Subsystem != "" {
		predicate += fmt.Sprintf(" AND subsystem == '%s'", cfg.Subsystem)
	}

	fmt.Fprintf(os.Stderr, "NOTE: print()/debugPrint() not available in attach mode. Use 'xclog launch' for full capture.\n")
	fmt.Fprintf(os.Stderr, "---\n")

	logCmd := exec.CommandContext(ctx, "log", "stream",
		"--level", "debug",
		"--style", "ndjson",
		"--predicate", predicate,
	)
	logStdout, err := logCmd.StdoutPipe()
	if err != nil {
		fatal("log stream pipe: %v", err)
	}
	if err := logCmd.Start(); err != nil {
		fatal("log stream failed: %v", err)
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		streamOSLogNDJSON(logStdout, lines, cfg)
	}()

	go func() {
		wg.Wait()
		cancel()
	}()

	writeLines(ctx, lines, cfg, out)
	cleanup([]*exec.Cmd{logCmd})
}

func runShow(target string, cfg *Config, out io.Writer) {
	predicate := ""
	if pid, err := strconv.Atoi(target); err == nil {
		predicate = fmt.Sprintf("processIdentifier == %d", pid)
	} else {
		predicate = fmt.Sprintf("process == %q", target)
	}

	if cfg.Subsystem != "" {
		predicate += fmt.Sprintf(" AND subsystem == '%s'", cfg.Subsystem)
	}

	var logShowArgs []string

	if cfg.DeviceUDID != "" {
		// Physical device: collect logs first, then show from archive
		fmt.Fprintf(os.Stderr, "Collecting logs from device %s (last %s)...\n", cfg.DeviceUDID, cfg.Last)

		tmpDir, err := os.MkdirTemp("", "xclog-*")
		if err != nil {
			fatal("cannot create temp dir: %v", err)
		}
		defer os.RemoveAll(tmpDir)

		archivePath := filepath.Join(tmpDir, "device.logarchive")
		collectArgs := []string{
			"collect",
			"--device-udid", cfg.DeviceUDID,
			"--last", cfg.Last,
			"--output", archivePath,
		}
		if predicate != "" {
			collectArgs = append(collectArgs, "--predicate", predicate)
		}

		collectCmd := exec.Command("log", collectArgs...)
		collectCmd.Stderr = os.Stderr
		if err := collectCmd.Run(); err != nil {
			fatal("log collect failed: %v (is the device connected and unlocked?)", err)
		}

		fmt.Fprintf(os.Stderr, "Collected. Parsing archive...\n")
		logShowArgs = []string{"show", archivePath,
			"--style", "ndjson",
			"--info", "--debug",
		}
	} else {
		// Simulator / local: query system log directly
		fmt.Fprintf(os.Stderr, "Showing logs (last %s) for %q\n", cfg.Last, target)
		logShowArgs = []string{"show",
			"--last", cfg.Last,
			"--style", "ndjson",
			"--info", "--debug",
			"--predicate", predicate,
		}
	}

	fmt.Fprintf(os.Stderr, "---\n")

	showCmd := exec.Command("log", logShowArgs...)
	showStdout, err := showCmd.StdoutPipe()
	if err != nil {
		fatal("log show pipe: %v", err)
	}
	if err := showCmd.Start(); err != nil {
		fatal("log show failed: %v", err)
	}

	lines := make(chan LogLine, 256)
	go func() {
		streamOSLogNDJSON(showStdout, lines, cfg)
		close(lines)
	}()

	reset := "\033[0m"
	count := 0
	hitLimit := false
	for line := range lines {
		writeLine(line, cfg, out, reset)
		count++
		if cfg.MaxLines > 0 && count >= cfg.MaxLines {
			hitLimit = true
			break
		}
	}

	if hitLimit {
		// Kill the process to stop producing output
		if showCmd.Process != nil {
			showCmd.Process.Kill()
		}
		// Drain the channel to unblock the goroutine
		for range lines {
		}
	}

	showCmd.Wait()

	if count == 0 {
		fmt.Fprintf(os.Stderr, "No matching log entries found.\n")
	} else {
		fmt.Fprintf(os.Stderr, "--- %d entries\n", count)
	}
}

// streamLines reads raw lines from a reader and sends them as LogLines.
// Used for stdout/stderr from simctl (no structured metadata available).
func streamLines(r io.Reader, src Source, out chan<- LogLine, cfg *Config) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		text := scanner.Text()
		if text == "" {
			continue
		}
		if !matchesFilter(text, cfg) {
			continue
		}
		out <- LogLine{
			Time:   time.Now(),
			Source: src,
			Text:   text,
		}
	}
	if err := scanner.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "xclog: %s scanner error: %v\n", src.Tag(), err)
	}
}

// streamOSLogNDJSON reads ndjson output (one JSON object per line) from `log stream`
// or `log show`. Extracts structured fields: timestamp, level, subsystem, category,
// process, PID. Skips the "Filtering the log data" header line automatically.
func streamOSLogNDJSON(r io.Reader, out chan<- LogLine, cfg *Config) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 || line[0] != '{' {
			continue // skip header lines and empty lines
		}

		var entry osLogEntry
		if err := json.Unmarshal(line, &entry); err != nil {
			continue
		}

		if entry.EventMessage == "" {
			continue
		}

		if !matchesFilter(entry.EventMessage, cfg) {
			continue
		}

		ts, err := time.Parse(osLogTimeLayout, entry.Timestamp)
		if err != nil {
			ts = time.Now()
		}

		out <- LogLine{
			Time:      ts,
			Source:    SourceOSLog,
			Level:     entry.MessageType,
			Subsystem: entry.Subsystem,
			Category:  entry.Category,
			Process:   processName(entry.ProcessImagePath),
			PID:       entry.ProcessID,
			Text:      entry.EventMessage,
		}
	}
	if err := scanner.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "xclog: os_log scanner error: %v\n", err)
	}
}

func writeLines(ctx context.Context, lines <-chan LogLine, cfg *Config, out io.Writer) {
	reset := "\033[0m"
	count := 0
	for {
		select {
		case <-ctx.Done():
			drain(lines, cfg, out, reset, &count)
			return
		case line := <-lines:
			writeLine(line, cfg, out, reset)
			count++
			if cfg.MaxLines > 0 && count >= cfg.MaxLines {
				return
			}
		}
	}
}

func drain(lines <-chan LogLine, cfg *Config, out io.Writer, reset string, count *int) {
	for {
		select {
		case line := <-lines:
			if cfg.MaxLines > 0 && *count >= cfg.MaxLines {
				return
			}
			writeLine(line, cfg, out, reset)
			*count++
		default:
			return
		}
	}
}

func writeLine(line LogLine, cfg *Config, out io.Writer, reset string) {
	if !cfg.Human {
		out.Write(formatJSON(line))
		return
	}

	ts := line.Time.Format("15:04:05.000")
	tag := line.Source.Tag()

	if cfg.NoColor {
		fmt.Fprintf(out, "[%s] [%-6s] %s\n", ts, tag, line.Text)
	} else {
		color := line.Source.Color()
		fmt.Fprintf(out, "%s[%s] [%-6s]%s %s\n", color, ts, tag, reset, line.Text)
	}
}

func cleanup(cmds []*exec.Cmd) {
	for _, cmd := range cmds {
		if cmd == nil || cmd.Process == nil {
			continue
		}
		cmd.Process.Signal(syscall.SIGTERM)
		waitDone := make(chan struct{})
		go func(c *exec.Cmd) {
			c.Wait()
			close(waitDone)
		}(cmd)
		select {
		case <-waitDone:
		case <-time.After(2 * time.Second):
			cmd.Process.Kill()
		}
	}
}

func fatal(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, "xclog: "+format+"\n", args...)
	os.Exit(1)
}
