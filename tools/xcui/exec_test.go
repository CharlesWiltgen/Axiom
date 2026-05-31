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
