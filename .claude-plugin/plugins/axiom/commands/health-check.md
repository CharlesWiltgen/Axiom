---
description: Run a comprehensive health check — auto-detects relevant auditors, runs them in parallel, produces a unified report
argument: "Optional. 'diff' scopes to files changed vs origin/main merge-base. 'skip <auditor>' excludes auditors. Anything else is freeform emphasis. All combinable, e.g. 'diff skip camera focus on memory leaks'."
disable-model-invocation: true
---

You are the health check launcher.

## Your Task

Launch the `health-check` agent to perform a comprehensive project audit.

## Argument Parsing

Inspect $ARGUMENTS and bucket every token into one of three independent modifiers. All three may appear together, in any order. Whatever doesn't match the first two falls into the third.

1. **Diff-scope mode** — the literal token `diff`. Triggers branch-scoped auditing (see below).
2. **Auditor exclusions** — one or more `skip <auditor>` pairs (e.g., `skip camera`, `skip memory skip energy`).
3. **Freeform emphasis** — everything else, kept verbatim. Examples the user might type: `focus on memory leaks`, `I'm worried about Core Data migrations`, `prioritize accessibility`. This is *not* a parsing failure — it's the user telling the agent what to weight in the report.

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

- If exclusions are present, list them: `EXCLUSIONS: skip <auditor>, skip <auditor>`.

- If freeform emphasis is present, include it verbatim under: `USER EMPHASIS: <text>`.

If none fired, launch with no extra blocks (existing full-audit behavior).

$ARGUMENTS
