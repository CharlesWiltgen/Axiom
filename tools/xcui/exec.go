package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"time"
)

// DefaultExecTimeout is used when no explicit timeout is provided.
// Override via XCUI_EXEC_TIMEOUT (seconds).
func DefaultExecTimeout() time.Duration {
	if v := os.Getenv("XCUI_EXEC_TIMEOUT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return time.Duration(n) * time.Second
		}
	}
	return 10 * time.Second
}

// ExecResult captures both stdout and stderr regardless of exit status.
type ExecResult struct {
	Stdout []byte
	Stderr []byte
}

// TimeoutError wraps command timeouts for exit-code 6 handling.
type TimeoutError struct {
	Cmd     string
	Timeout time.Duration
}

func (e *TimeoutError) Error() string {
	return fmt.Sprintf("command timed out after %s: %s", e.Timeout, e.Cmd)
}

func IsTimeoutError(err error) bool {
	var te *TimeoutError
	return errors.As(err, &te)
}

// ExecRun runs a command with a timeout, returning both stdout and stderr.
func ExecRun(ctx context.Context, timeout time.Duration, name string, args ...string) (ExecResult, error) {
	return ExecRunEnv(ctx, timeout, nil, name, args...)
}

// ExecRunEnv is ExecRun with extra environment variables (each "KEY=VALUE")
// appended to the current process environment. Pass nil to inherit unchanged.
func ExecRunEnv(ctx context.Context, timeout time.Duration, env []string, name string, args ...string) (ExecResult, error) {
	if timeout <= 0 {
		timeout = DefaultExecTimeout()
	}
	cctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	cmd := exec.CommandContext(cctx, name, args...)
	if len(env) > 0 {
		cmd.Env = append(os.Environ(), env...)
	}
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	res := ExecResult{Stdout: stdout.Bytes(), Stderr: stderr.Bytes()}
	if err == nil {
		return res, nil
	}
	select {
	case <-cctx.Done():
		if ctx.Err() != nil {
			return res, fmt.Errorf("%s cancelled: %w", name, ctx.Err())
		}
		return res, &TimeoutError{Cmd: name, Timeout: timeout}
	default:
		return res, fmt.Errorf("%s: %w: %s", name, err, stderr.String())
	}
}
