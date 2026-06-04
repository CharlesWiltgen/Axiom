package main

import "testing"

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
