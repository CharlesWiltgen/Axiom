package main

import (
	"encoding/json"
	"regexp"
	"strings"
	"testing"
	"time"
)

func TestFormatJSON(t *testing.T) {
	line := LogLine{
		Time:   time.Date(2025, 3, 15, 10, 30, 45, 123000000, time.UTC),
		Source: SourceStdout,
		Text:   "Hello world",
	}

	got := string(formatJSON(line))
	want := `{"time":"10:30:45.123","source":"print","text":"Hello world"}` + "\n"
	if got != want {
		t.Errorf("formatJSON() = %q, want %q", got, want)
	}
}

func TestFormatJSONEscaping(t *testing.T) {
	line := LogLine{
		Time:   time.Date(2025, 3, 15, 10, 0, 0, 0, time.UTC),
		Source: SourceOSLog,
		Text:   `key: "value" with \backslash and	tab`,
	}

	got := string(formatJSON(line))
	want := `{"time":"10:00:00.000","source":"os_log","text":"key: \"value\" with \\backslash and\ttab"}` + "\n"
	if got != want {
		t.Errorf("formatJSON() = %q, want %q", got, want)
	}
}

func TestFormatJSONRichFields(t *testing.T) {
	line := LogLine{
		Time:      time.Date(2025, 3, 15, 10, 30, 0, 0, time.UTC),
		Source:    SourceOSLog,
		Level:     "Error",
		Subsystem: "com.example.MyApp",
		Category:  "networking",
		Process:   "MyApp",
		PID:       12345,
		Text:      "Connection failed",
	}

	got := string(formatJSON(line))

	// Parse back and verify fields
	var parsed jsonOutputLine
	if err := json.Unmarshal([]byte(got), &parsed); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	if parsed.Level != "error" {
		t.Errorf("level = %q, want %q", parsed.Level, "error")
	}
	if parsed.Subsystem != "com.example.MyApp" {
		t.Errorf("subsystem = %q, want %q", parsed.Subsystem, "com.example.MyApp")
	}
	if parsed.Category != "networking" {
		t.Errorf("category = %q, want %q", parsed.Category, "networking")
	}
	if parsed.Process != "MyApp" {
		t.Errorf("process = %q, want %q", parsed.Process, "MyApp")
	}
	if parsed.PID != 12345 {
		t.Errorf("pid = %d, want %d", parsed.PID, 12345)
	}
}

func TestFormatJSONOmitsEmpty(t *testing.T) {
	line := LogLine{
		Time:   time.Date(2025, 3, 15, 10, 0, 0, 0, time.UTC),
		Source: SourceStdout,
		Text:   "Hello from print",
	}

	got := string(formatJSON(line))

	// stdout lines should NOT have level, subsystem, category, process, pid
	if strings.Contains(got, `"level"`) {
		t.Errorf("stdout line should omit level, got: %s", got)
	}
	if strings.Contains(got, `"subsystem"`) {
		t.Errorf("stdout line should omit subsystem, got: %s", got)
	}
	if strings.Contains(got, `"pid"`) {
		t.Errorf("stdout line should omit pid, got: %s", got)
	}
}

func TestFormatJSONSources(t *testing.T) {
	tests := []struct {
		source Source
		tag    string
	}{
		{SourceStdout, "print"},
		{SourceStderr, "stderr"},
		{SourceOSLog, "os_log"},
	}

	for _, tt := range tests {
		t.Run(tt.tag, func(t *testing.T) {
			line := LogLine{
				Time:   time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
				Source: tt.source,
				Text:   "test",
			}
			got := string(formatJSON(line))
			if !strings.Contains(got, `"source":"`+tt.tag+`"`) {
				t.Errorf("expected source %q in %s", tt.tag, got)
			}
		})
	}
}

func TestMatchesFilter(t *testing.T) {
	tests := []struct {
		text    string
		pattern string
		want    bool
	}{
		{"CoverSheet activated", "CoverSheet", true},
		{"SpringBoard loaded", "CoverSheet", false},
		{"Error: connection failed", "(?i)error", true},
		{"everything is fine", "(?i)error", false},
		{"any line", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.text+"_"+tt.pattern, func(t *testing.T) {
			var cfg Config
			if tt.pattern != "" {
				cfg.filterRe = regexp.MustCompile(tt.pattern)
			}
			got := matchesFilter(tt.text, &cfg)
			if got != tt.want {
				t.Errorf("matchesFilter(%q, %q) = %v, want %v", tt.text, tt.pattern, got, tt.want)
			}
		})
	}
}

func TestMatchesFilterNilRegex(t *testing.T) {
	cfg := Config{}
	if !matchesFilter("anything", &cfg) {
		t.Error("nil filterRe should match everything")
	}
}

func TestMatchesFilterPreCompiled(t *testing.T) {
	cfg := Config{filterRe: regexp.MustCompile("hello")}
	if !matchesFilter("hello world", &cfg) {
		t.Error("should match")
	}
	if matchesFilter("goodbye world", &cfg) {
		t.Error("should not match")
	}
}

func TestSubsystemValidation(t *testing.T) {
	valid := []string{"com.example.MyApp", "MyApp", "com.apple.UIKit", "my_app.v2"}
	for _, s := range valid {
		if !subsystemRe.MatchString(s) {
			t.Errorf("subsystemRe should accept %q", s)
		}
	}

	invalid := []string{"' OR 1==1", "foo bar", "a;b", "x'y"}
	for _, s := range invalid {
		if subsystemRe.MatchString(s) {
			t.Errorf("subsystemRe should reject %q", s)
		}
	}
}

func TestProcessName(t *testing.T) {
	tests := []struct {
		path string
		want string
	}{
		{"/usr/libexec/SpringBoard", "SpringBoard"},
		{"/Applications/MyApp.app/MyApp", "MyApp"},
		{"/kernel", "kernel"},
		{"MyApp", "MyApp"},
		{"", ""},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := processName(tt.path)
			if got != tt.want {
				t.Errorf("processName(%q) = %q, want %q", tt.path, got, tt.want)
			}
		})
	}
}

func TestStreamOSLogJSON(t *testing.T) {
	// Simulate `log stream --style json` output
	input := `Filtering the log data using "processIdentifier == 123"
[{"timestamp":"2025-03-15 10:30:45.123456-0700","eventMessage":"Hello from Logger","messageType":"Default","subsystem":"com.example.MyApp","category":"general","processID":123,"processImagePath":"\/Applications\/MyApp.app\/MyApp"},
{"timestamp":"2025-03-15 10:30:46.000000-0700","eventMessage":"Error occurred","messageType":"Error","subsystem":"com.example.MyApp","category":"networking","processID":123,"processImagePath":"\/Applications\/MyApp.app\/MyApp"}]
`

	lines := make(chan LogLine, 10)
	cfg := &Config{}

	go func() {
		streamOSLogJSON(strings.NewReader(input), lines, cfg)
		close(lines)
	}()

	var results []LogLine
	for line := range lines {
		results = append(results, line)
	}

	if len(results) != 2 {
		t.Fatalf("expected 2 lines, got %d", len(results))
	}

	first := results[0]
	if first.Text != "Hello from Logger" {
		t.Errorf("text = %q, want %q", first.Text, "Hello from Logger")
	}
	if first.Level != "Default" {
		t.Errorf("level = %q, want %q", first.Level, "Default")
	}
	if first.Subsystem != "com.example.MyApp" {
		t.Errorf("subsystem = %q, want %q", first.Subsystem, "com.example.MyApp")
	}
	if first.Category != "general" {
		t.Errorf("category = %q, want %q", first.Category, "general")
	}
	if first.Process != "MyApp" {
		t.Errorf("process = %q, want %q", first.Process, "MyApp")
	}
	if first.PID != 123 {
		t.Errorf("pid = %d, want %d", first.PID, 123)
	}
	if first.Time.Hour() != 10 || first.Time.Minute() != 30 {
		t.Errorf("time = %v, want 10:30", first.Time.Format("15:04"))
	}

	second := results[1]
	if second.Level != "Error" {
		t.Errorf("second level = %q, want %q", second.Level, "Error")
	}
}

func TestStreamOSLogJSONWithFilter(t *testing.T) {
	input := `Filtering the log data
[{"timestamp":"2025-03-15 10:00:00.000000-0700","eventMessage":"keep this","messageType":"Default","subsystem":"","category":"","processID":1,"processImagePath":"/bin/test"},
{"timestamp":"2025-03-15 10:00:01.000000-0700","eventMessage":"drop this","messageType":"Default","subsystem":"","category":"","processID":1,"processImagePath":"/bin/test"}]
`

	lines := make(chan LogLine, 10)
	cfg := &Config{filterRe: regexp.MustCompile("keep")}

	go func() {
		streamOSLogJSON(strings.NewReader(input), lines, cfg)
		close(lines)
	}()

	var results []LogLine
	for line := range lines {
		results = append(results, line)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 filtered line, got %d", len(results))
	}
	if results[0].Text != "keep this" {
		t.Errorf("text = %q, want %q", results[0].Text, "keep this")
	}
}

func TestStreamOSLogJSONEmptyInput(t *testing.T) {
	lines := make(chan LogLine, 10)
	cfg := &Config{}

	go func() {
		streamOSLogJSON(strings.NewReader(""), lines, cfg)
		close(lines)
	}()

	var results []LogLine
	for line := range lines {
		results = append(results, line)
	}

	if len(results) != 0 {
		t.Errorf("expected 0 lines from empty input, got %d", len(results))
	}
}

// FuzzStreamOSLogJSON exercises the JSON parser with arbitrary input.
// Run: go test -fuzz=FuzzStreamOSLogJSON -fuzztime=30s
func FuzzStreamOSLogJSON(f *testing.F) {
	f.Add(`[{"timestamp":"2025-03-15 10:30:45.123456-0700","eventMessage":"msg","messageType":"Default","subsystem":"","category":"","processID":0,"processImagePath":""}]`)
	f.Add(`Filtering header text [{}]`)
	f.Add(``)
	f.Add(`[{"timestamp":"invalid","eventMessage":"msg","messageType":"Error","subsystem":"","category":"","processID":0,"processImagePath":""}]`)

	f.Fuzz(func(t *testing.T, input string) {
		lines := make(chan LogLine, 100)
		cfg := &Config{}

		go func() {
			streamOSLogJSON(strings.NewReader(input), lines, cfg)
			close(lines)
		}()

		for line := range lines {
			if line.Text == "" {
				t.Error("parsed line with empty text")
			}
			if line.Source != SourceOSLog {
				t.Errorf("source = %v, want SourceOSLog", line.Source)
			}
		}
	})
}
