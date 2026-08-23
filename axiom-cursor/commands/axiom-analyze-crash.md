---
name: axiom-analyze-crash
description: "Analyze iOS and macOS crash logs with Axiom MCP symbolication tools"
---

# Analyze Crash Log

Use Axiom's structured MCP tools instead of invoking the xcsym helper binary.

1. Accept either an existing crash-file path or pasted crash-report content. If neither is present or the input is ambiguous, ask the user for one crash report before continuing.
2. For a file path, pass the verified readable file path directly in `file`. A readable `.xccrashpoint` bundle path is also valid. Never execute or rewrite a user-supplied path.
3. For pasted content, create a task-scoped temporary directory with mode `0700` and a new file with mode `0600` outside the repository. Create the file exclusively with a fixed, non-user-derived name and an extension appropriate to JSON or text. Write the content with a filesystem write operation that does not interpolate it into a shell command. Do not include the crash content in a command line, log, diagnostic, or filename.
4. Call `axiom_xcsym_crash` with the selected path in `file` and only `summary`, `standard`, or `full` in `format`. Use `standard` unless the user requests another output tier; pass only other schema-supported fields that the user supplied or the analysis requires.
5. Interpret the returned pattern, crashed-thread frames, and dSYM completeness even when the tool reports a non-zero completeness status.
6. For dSYM mismatches, call `axiom_xcsym_verify` with the same path in `file`, then call `axiom_xcsym_find_dsym` with the expected `uuid` when discovery is needed.
7. After all MCP calls finish or fail, remove only the temporary file and directory created for this request. Never remove or modify a user-supplied crash path.
8. Report the likely root cause, evidence, symbolication limits, and concrete next steps.

If a required MCP tool is unavailable, stop and report that the Axiom MCP integration is missing; do not fall back to a same-named executable.