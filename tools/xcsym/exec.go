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

// ExecResult captures both stdout and stderr regardless of exit status.
// atos writes UUID-mismatch warnings to stderr on exit 0; dwarfdump often
// writes partial output to stdout before erroring. Callers need both.
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
//
// Error semantics:
//   - Our deadline fired (not parent ctx): *TimeoutError
//   - Parent ctx cancelled or deadlined: wrapped ctx.Err()
//   - Command exited nonzero: wrapped *exec.ExitError
//
// On any error the returned ExecResult still holds whatever output was
// captured before the process died.
func ExecRun(ctx context.Context, timeout time.Duration, name string, args ...string) (ExecResult, error) {
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
	res := ExecResult{Stdout: stdout.Bytes(), Stderr: stderr.Bytes()}
	if err == nil {
		return res, nil
	}
	// Distinguish our deadline from parent cancellation from plain exit failure.
	// cctx.Done() is closed only when our deadline fires OR parent is cancelled.
	// A command that exits nonzero on its own leaves cctx undone.
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
