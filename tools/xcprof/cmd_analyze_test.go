package main

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestIsMissingExportableTables(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"nil", nil, false},
		{"verbatim xctrace failure", errors.New("xcrun: exit status 10: Export failed: Document Missing Template Error"), true},
		{"unrelated export failure", errors.New("xcrun: exit status 1: device not found"), false},
	}
	for _, c := range cases {
		if got := isMissingExportableTables(c.err); got != c.want {
			t.Errorf("%s: isMissingExportableTables = %v, want %v", c.name, got, c.want)
		}
	}
}

// An unfinalized / non-exportable trace must yield an actionable message, not
// the opaque "Document Missing Template Error" / "export toc:" wrapper.
func TestAnalyzeTraceMapsMissingTemplateError(t *testing.T) {
	orig := exportTOC
	t.Cleanup(func() { exportTOC = orig })
	exportTOC = func(context.Context, string) ([]byte, error) {
		return nil, errors.New("xcrun: exit status 10: Export failed: Document Missing Template Error")
	}

	_, err := analyzeTrace(context.Background(), "interrupted.trace", analyzeOpts{})
	if err == nil {
		t.Fatal("expected an error for a trace with no exportable tables")
	}
	msg := err.Error()
	if strings.Contains(msg, xctraceMissingTemplate) || strings.Contains(msg, "export toc:") {
		t.Errorf("error should be mapped, not the raw xctrace failure: %q", msg)
	}
	if !strings.Contains(msg, "no xctrace-exportable tables") || !strings.Contains(msg, "Instruments") {
		t.Errorf("error should name the cause and point to Instruments, got: %q", msg)
	}
}

func TestParseAnalyzeArgsFlagAfterTrace(t *testing.T) {
	trace, opts, code := parseAnalyzeArgs([]string{"cpu.trace", "--json"})
	if code != 0 || trace != "cpu.trace" || !opts.asJSON {
		t.Errorf("got trace=%q json=%v code=%d, want cpu.trace/true/0", trace, opts.asJSON, code)
	}
}

func TestParseAnalyzeArgsFlagBeforeTrace(t *testing.T) {
	trace, opts, code := parseAnalyzeArgs([]string{"--json", "cpu.trace"})
	if code != 0 || trace != "cpu.trace" || !opts.asJSON {
		t.Errorf("got trace=%q json=%v code=%d, want cpu.trace/true/0", trace, opts.asJSON, code)
	}
}

func TestParseAnalyzeArgsValueFlagAfterTrace(t *testing.T) {
	trace, opts, code := parseAnalyzeArgs([]string{"cpu.trace", "--start-ms", "600", "--end-ms", "700"})
	if code != 0 || trace != "cpu.trace" || opts.startMS != 600 || opts.endMS != 700 {
		t.Errorf("got trace=%q start=%d end=%d code=%d", trace, opts.startMS, opts.endMS, code)
	}
}

func TestParseAnalyzeArgsNoTrace(t *testing.T) {
	if _, _, code := parseAnalyzeArgs([]string{"--json"}); code != 2 {
		t.Errorf("expected usage error (2) when no trace given, got %d", code)
	}
}

func TestParseAnalyzeArgsTwoTraces(t *testing.T) {
	if _, _, code := parseAnalyzeArgs([]string{"a.trace", "b.trace"}); code != 2 {
		t.Errorf("expected usage error (2) for two traces, got %d", code)
	}
}

func TestParseAnalyzeArgsUserBinaryList(t *testing.T) {
	_, opts, code := parseAnalyzeArgs([]string{"cpu.trace", "--user-binary", "MyApp,MyKit"})
	if code != 0 || len(opts.userHints) != 2 || opts.userHints[0] != "MyApp" {
		t.Errorf("got hints=%v code=%d", opts.userHints, code)
	}
}

func TestParseAnalyzeArgsUserBinaryTrailingComma(t *testing.T) {
	// A trailing comma must not inject an empty hint (which would otherwise
	// match nameless/unsymbolicated frames as user code).
	_, opts, _ := parseAnalyzeArgs([]string{"cpu.trace", "--user-binary", "MyApp, ,"})
	for _, h := range opts.userHints {
		if h == "" {
			t.Errorf("empty hint leaked through: %v", opts.userHints)
		}
	}
	if len(opts.userHints) != 1 || opts.userHints[0] != "MyApp" {
		t.Errorf("hints = %v, want [MyApp]", opts.userHints)
	}
}
