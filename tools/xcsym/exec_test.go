package main

import (
	"context"
	"testing"
	"time"
)

func TestExecRunSuccess(t *testing.T) {
	out, err := ExecRun(context.Background(), 5*time.Second, "echo", "hello")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(out) != "hello\n" {
		t.Errorf("expected 'hello\\n', got %q", out)
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
	_, err := ExecRun(context.Background(), 5*time.Second, "false")
	if err == nil {
		t.Fatal("expected nonzero error")
	}
	if IsTimeoutError(err) {
		t.Error("should not be timeout error")
	}
}
