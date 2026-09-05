---
description: Run a comprehensive health check — auto-detects relevant auditors, runs them in parallel, produces a unified report
argument-hint: "[diff] [compiler] [skip <auditor>] [freeform emphasis]"
disable-model-invocation: true
---

You are the health check launcher.

## Your Task

Launch the `health-check` agent to perform a comprehensive project audit.

## Argument Parsing

Inspect $ARGUMENTS and bucket every token into one of four independent modifiers. All four may appear together, in any order. Whatever doesn't match the first three falls into the fourth.

1. **Diff-scope mode** — the literal token `diff`. Triggers branch-scoped auditing (see below).
2. **Compiler lane** — the literal token `compiler`. Builds once and hands real compiler diagnostics to the auditors (see below). Opt-in because it costs a full non-incremental build.
3. **Auditor exclusions** — one or more `skip <auditor>` pairs (e.g., `skip camera`, `skip memory skip energy`).
4. **Freeform emphasis** — everything else, kept verbatim. Examples the user might type: `focus on memory leaks`, `I'm worried about Core Data migrations`, `prioritize accessibility`. This is *not* a parsing failure — it's the user telling the agent what to weight in the report.

### Diff-scope mode

If `diff` is present, compute the file scope yourself before launching the agent (the agent has no Bash tool):

1. **Determine the base ref.** Try in order: `origin/main`, `origin/master`, `main`, `master`. Use `git rev-parse --verify <ref> 2>/dev/null` to test each. If none resolve, abort with:

   > No default base ref found (tried `origin/main`, `origin/master`, `main`, `master`). This branch has no obvious main to diff against.

2. **Verify a git repo.** Run `git rev-parse --git-dir 2>/dev/null`. If it fails, abort with:

   > Not a git repository. `/axiom:health-check diff` requires git.

3. **Compute merge-base.** Run `git merge-base <base> HEAD`. Capture the SHA. If it fails, abort with the actual error.

4. **Compute changed files.** Run:

   ```bash
   git diff --name-only --diff-filter=ACMR -M <merge-base>...HEAD
   ```

   Filter the result to files matching `*.swift` (auditors only inspect Swift). Other changed files (assets, plists, project files) do not gate this audit.

5. **Empty diff.** If the filtered list is empty, exit cleanly with:

   > No changed Swift files vs `<base>` (merge-base: `<short-SHA>`). Nothing to audit.

   Do not launch the agent.

### Compiler lane

If `compiler` is present, produce real compiler diagnostics before launching the agent. Auditors have no Bash tool, so this runs here, exactly once per health-check — never once per auditor.

1. **Check for existing builds.** Run `pgrep -x xcodebuild | wc -l`. If non-zero, do not start a build. Skip the lane and note it; a concurrent `xcodebuild` spawns 50-100+ child processes that persist if interrupted.

2. **Find a scheme.** Run `xcodebuild -list -json` in the project root. Take the first entry of `.workspace.schemes` or `.project.schemes`. If the command fails or lists no schemes, skip the lane.

3. **Build once**, into a scratch result bundle:

   ```bash
   xcodebuild -scheme <scheme> -destination 'platform=macOS' \
     -resultBundlePath <scratch>/health.xcresult \
     OTHER_SWIFT_FLAGS='-strict-concurrency=complete' build
   ```

   Use a simulator destination instead for an iOS-only scheme. Do not pipe this through `grep`/`tail` — interrupting it orphans the build. Let it finish, then read the bundle.

   **A non-zero exit is not a failure of this lane.** A build that fails *because of* the concurrency errors being audited still produces them. Proceed to step 4 regardless of exit code; only skip the lane if no result bundle was written.

4. **Extract diagnostics:**

   ```bash
   xcrun xcresulttool get build-results --path <scratch>/health.xcresult --compact
   ```

   The JSON carries `errors[]` and `warnings[]`. Each entry has `issueType`, `message`, and a `sourceURL` whose **line number lives in the URL fragment** (`#StartingLineNumber=12`), not in a field of its own — parse it out.

   `issueType` is sometimes a structured identifier (`SendingClosureRisksDataRace`) and sometimes the generic `Swift Compiler Error`, in which case the `message` text is what identifies the diagnostic.

5. **Skip cleanly on any failure.** No scheme, no bundle, extraction error — omit the block and let the auditors use their grep fallbacks. Never abort the health check over the compiler lane.

### Building the agent's launch prompt

Assemble the prompt from whichever buckets fired:

- If diff-scope mode is active, include this block verbatim:

  ```
  DIFF SCOPE
  Base ref: <base>
  Merge-base: <full-SHA>
  Changed Swift files (N):
  <one path per line>
  ```

- If the compiler lane produced diagnostics, include this block verbatim:

  ```
  COMPILER DIAGNOSTICS
  Scheme: <scheme> | Destination: <destination> | Build status: <succeeded|failed>
  Flags: -strict-concurrency=complete
  Diagnostics (N):
  <file>:<line> [<issueType>] <message>
  ```

  One diagnostic per line, errors before warnings. If the lane was requested but skipped, say so instead and give the reason: `COMPILER DIAGNOSTICS: unavailable (<reason>)`.

- If exclusions are present, list them: `EXCLUSIONS: skip <auditor>, skip <auditor>`.

- If freeform emphasis is present, include it verbatim under: `USER EMPHASIS: <text>`.

If none fired, launch with no extra blocks (existing full-audit behavior).

$ARGUMENTS
