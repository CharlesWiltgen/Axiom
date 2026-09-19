package main

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestExecRunCapturesStdout(t *testing.T) {
	res, err := ExecRun(context.Background(), 5*time.Second, "echo", "hello")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if strings.TrimSpace(string(res.Stdout)) != "hello" {
		t.Errorf("stdout = %q, want %q", res.Stdout, "hello")
	}
}

func TestExecRunTimeout(t *testing.T) {
	_, err := ExecRun(context.Background(), 50*time.Millisecond, "sleep", "5")
	if !IsTimeoutError(err) {
		t.Errorf("expected TimeoutError, got %v", err)
	}
}

// execCall records one subprocess xcui would have run.
type execCall struct {
	name string
	args []string
}

// withFakeExec replaces the ExecRun seam for the duration of a test, answering
// every call with stdout. It returns the calls made, so a test can assert that a
// path shelled out — or, more usefully, that it did not.
func withFakeExec(t *testing.T, stdout string) *[]execCall {
	t.Helper()
	calls := &[]execCall{}
	orig := execRun
	execRun = func(ctx context.Context, timeout time.Duration, name string, args ...string) (ExecResult, error) {
		*calls = append(*calls, execCall{name: name, args: args})
		return ExecResult{Stdout: []byte(stdout)}, nil
	}
	t.Cleanup(func() { execRun = orig })
	return calls
}
