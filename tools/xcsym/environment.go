package main

import (
	"context"
	"regexp"
	"runtime"
	"strconv"
	"strings"
)

// CaptureEnvironment shells out to atos, xcrun, xcode-select to snapshot
// the symbolication toolchain. Any individual failure is tolerated — the
// field is left empty rather than failing the whole capture.
func CaptureEnvironment(ctx context.Context) (Environment, error) {
	env := Environment{HostArch: runtime.GOARCH}

	// atos has no --version flag, so we capture its resolved path via xcrun
	// as a reproducibility marker (reveals which toolchain supplied it).
	if res, err := ExecRun(ctx, 0, "xcrun", "--find", "atos"); err == nil {
		env.AtosVersion = strings.TrimSpace(string(res.Stdout))
	}
	// swift-demangle likewise has no --version; capture path instead.
	if res, err := ExecRun(ctx, 0, "xcrun", "--find", "swift-demangle"); err == nil {
		env.SwiftDemangleVersion = strings.TrimSpace(string(res.Stdout))
	}
	if res, err := ExecRun(ctx, 0, "xcode-select", "-p"); err == nil {
		env.XcodePath = strings.TrimSpace(string(res.Stdout))
	}
	if res, err := ExecRun(ctx, 0, "pkgutil", "--pkg-info=com.apple.pkg.CLTools_Executables"); err == nil {
		env.CLTVersion = extractCLTVersion(string(res.Stdout))
	}
	if env.CLTVersion == "" {
		if res, err := ExecRun(ctx, 0, "xcodebuild", "-version"); err == nil {
			env.CLTVersion = strings.TrimSpace(string(res.Stdout))
		}
	}
	return env, nil
}

// extractCLTVersion pulls "version: X.Y.Z" from pkgutil output.
func extractCLTVersion(s string) string {
	for _, line := range strings.Split(s, "\n") {
		if strings.HasPrefix(strings.ToLower(line), "version:") {
			return strings.TrimSpace(strings.SplitN(line, ":", 2)[1])
		}
	}
	return ""
}

// IsCLTBelowMinimum returns true if the CLT version string indicates an Xcode
// major version older than minMajor.
var xcodeMajorRe = regexp.MustCompile(`Xcode\s+(\d+)`)

func IsCLTBelowMinimum(cltVersion string, minMajor int) bool {
	m := xcodeMajorRe.FindStringSubmatch(cltVersion)
	if m == nil {
		return false
	}
	major, err := strconv.Atoi(m[1])
	if err != nil {
		return false
	}
	return major < minMajor
}
