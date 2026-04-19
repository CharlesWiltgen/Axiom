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
// Override via XCSYM_EXEC_TIMEOUT (seconds).
func DefaultExecTimeout() time.Duration {
	if v := os.Getenv("XCSYM_EXEC_TIMEOUT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return time.Duration(n) * time.Second
		}
	}
	return 10 * time.Second
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

// ExecRun runs a command with a timeout, returning stdout on success.
// On timeout returns *TimeoutError. On nonzero exit returns the combined output in the error.
func ExecRun(ctx context.Context, timeout time.Duration, name string, args ...string) ([]byte, error) {
	if timeout <= 0 {
		timeout = DefaultExecTimeout()
	}
	cctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	cmd := exec.CommandContext(cctx, name, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if cctx.Err() == context.DeadlineExceeded {
		return nil, &TimeoutError{Cmd: name, Timeout: timeout}
	}
	if err != nil {
		return nil, fmt.Errorf("%s: %w: %s", name, err, stderr.String())
	}
	return stdout.Bytes(), nil
}
