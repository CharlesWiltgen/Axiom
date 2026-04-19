package main

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestExecRunSuccess(t *testing.T) {
	res, err := ExecRun(context.Background(), 5*time.Second, "echo", "hello")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(res.Stdout) != "hello\n" {
		t.Errorf("expected stdout 'hello\\n', got %q", res.Stdout)
	}
	if len(res.Stderr) != 0 {
		t.Errorf("expected empty stderr, got %q", res.Stderr)
	}
}

func TestExecRunCapturesStderrOnSuccess(t *testing.T) {
	// `sh -c 'echo out; echo err >&2'` exits 0 with content in both streams.
	res, err := ExecRun(context.Background(), 5*time.Second, "sh", "-c", "echo out; echo err >&2")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(res.Stdout) != "out\n" {
		t.Errorf("stdout: got %q, want %q", res.Stdout, "out\n")
	}
	if string(res.Stderr) != "err\n" {
		t.Errorf("stderr: got %q, want %q", res.Stderr, "err\n")
	}
}

func TestExecRunTimeout(t *testing.T) {
	_, err := ExecRun(context.Background(), 100*time.Millisecond, "sleep", "1")
	if err == nil {
		t.Fatal("expected timeout error")
	}
	if !IsTimeoutError(err) {
		t.Errorf("expected timeout error, got: %v", err)
	}
}

func TestExecRunNonzero(t *testing.T) {
	res, err := ExecRun(context.Background(), 5*time.Second, "sh", "-c", "echo partial; echo why >&2; exit 7")
	if err == nil {
		t.Fatal("expected nonzero error")
	}
	if IsTimeoutError(err) {
		t.Error("should not be timeout error")
	}
	if string(res.Stdout) != "partial\n" {
		t.Errorf("stdout on failure: got %q, want %q", res.Stdout, "partial\n")
	}
	if string(res.Stderr) != "why\n" {
		t.Errorf("stderr on failure: got %q, want %q", res.Stderr, "why\n")
	}
}

func TestExecRunParentCancelNotMisclassified(t *testing.T) {
	// Parent context cancellation must not report as *TimeoutError.
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()
	_, err := ExecRun(ctx, 10*time.Second, "sleep", "5")
	if err == nil {
		t.Fatal("expected cancellation error")
	}
	if IsTimeoutError(err) {
		t.Errorf("parent cancellation misclassified as timeout: %v", err)
	}
	if !errors.Is(err, context.Canceled) {
		t.Errorf("expected wrapped context.Canceled, got: %v", err)
	}
}
