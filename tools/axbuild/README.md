# axbuild

Capture `xcodebuild`, `swift build`, or `swift test` and return diagnostics as valid JSON within 8,000 UTF-8 bytes, including the final newline. The full report and original output remain in a unique temporary run directory. A startup JSON record on stderr gives its path before the command starts.

```sh
make test
make install
axbuild --help
pgrep -lx xcodebuild; echo "pgrep exit=$?"
axbuild xcodebuild -scheme App -destination 'platform=macOS' build
axbuild swift test --package-path ./Package
axbuild --format json -- swift build
```

Investigate existing builds before launching another. The wrapper owns its child process group and never terminates another build. Builds can execute scripts, plugins, macros, and tests; the executable allowlist is an interface constraint.

## Reports and exits

Inspect `command` and `collection` separately. A native exit of zero can accompany partial collection. The wrapper preserves the native exit code after reader or report failures. INT, TERM, and HUP return 128 plus the first signal while retaining the child's actual exit or terminating signal. Informational native commands pass their output and status through.

The raw log is the primary compiler source. Xcode test results and validated Swift Testing events supplement it. Known issues and warnings do not establish failed tests. When tests started or the run did not fail, the failed-test count is null if identities or classifications are ambiguous, an expected test-results or event source was not read, the run was interrupted, a `swift test` run failed with a signal exit (`exited with unexpected signal code`), or the run failed without an identified failing test. A failure before any test started, such as a compiler error or an unresolved package, leaves the count at 0. Runtime trap lines (`Fatal error`, `Precondition failed`, `Assertion failed`) are retained as located diagnostics, as notes when the command succeeded. Cross-source matches require unique compatible evidence. Repeated issues from one source remain distinct.

`omissions` describes bounded output. Read `artifacts.report` for complete diagnostics and evaluated values; artifact paths resolve relative to the absolute `artifacts.run` directory. Caller-owned result paths are preserved and checked for freshness before ingestion. Temporary storage is available for follow-up until the operating system clears it.

Missing optional stream support produces a collection issue and retains log diagnostics. Version 0 and 6.3.0 event schemas have decoders; automatic event flags require an exact validated toolchain mapping. Xcode 27.2 beta build 27B5028f / Swift 6.4 build 6.4.0.34.1 is currently validated. Xcode 26 remains an untested compatibility gap.

Capability probes have five-second limits, result readers 30 seconds, and post-command collection a shared 60 seconds. Teardown allows five seconds before KILL and one further second to reap owned children. These limits apply to collection; build/test duration is unrestricted.

## Distribution and building

Claude Code carries `bin/axbuild` in the canonical plugin; Codex carries the same executable in its generated package. Resolve the package path and check executable permission and `--help` before use. Pi discovers an installed helper on PATH; it does not bundle this executable. Cursor and MCP clients use their saved-log fallback until shell helper access is available.

Build with Swift 6.4 or newer. `make install` builds arm64 and x86_64 for macOS 14 and records source and installed-binary hashes in `build-info/axbuild.json`. Axiom's supported runtime policy is macOS 26 or newer. Compilation target, supported runtime policy, and tested child toolchains are separate properties. The package has no third-party dependencies or license placeholder.

Pure Swift tests live beside source; controlled subprocess tests use `AXIOM_AXBUILD` to select a fresh executable. Real Xcode/CPU acceptance runs separately from the default unit suite.

Progress output can appear inside a diagnostic header in the captured log. A compiler location whose file cannot be identified remains literal and makes collection partial; the wrapper does not reconstruct filenames from separated fragments. Native acceptance preserves such input-framing gaps separately from reader correctness.

Failure-recovery hints remain silent in Claude/Codex/Cursor because a trustworthy native completed-failure envelope has not been verified. Pure matcher tests do not establish native adapter coverage.

On the tested Xcode 27.2 beta, cancellation can leave build scripts in detached process groups. axbuild tears down its safely owned group and reports `cleanup-incomplete` for unverifiable detached jobs. Verify and stop only independently identified task-owned jobs; the wrapper does not claim to clean every Xcode descendant.
