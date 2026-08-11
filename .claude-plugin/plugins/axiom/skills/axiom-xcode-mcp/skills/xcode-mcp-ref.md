
# Xcode MCP Tool Reference

Complete reference for all 20 tools exposed by Xcode's MCP server (`xcrun mcpbridge`).

**Source**: Xcode 26.3 `tools/list` response. Validated against Keith Smiley's gist (2025-07-15).

**Critical**: `tabIdentifier` is required by 18 of 20 tools. Always call `XcodeListWindows` first.

## Discovery

### XcodeListWindows

Returns open Xcode windows. **Call this first** to get `tabIdentifier` values.

- **Parameters**: None
- **Returns**: `{ message: string }` — description of open windows
- **Notes**: Only tool that does not require `tabIdentifier`.

---

## File Operations

### XcodeRead

Read file contents (cat -n format, 600 lines default).

- **Parameters**:
  - `tabIdentifier` (string, required)
  - `filePath` (string, required) — project-relative or absolute
  - `limit` (integer, optional) — max lines to return
  - `offset` (integer, optional) — starting line number
- **Returns**: `{ content, filePath, fileSize, linesRead, startLine, totalLines }`

### XcodeWrite

Create or overwrite a file. Automatically adds new files to the project structure.

- **Parameters**:
  - `tabIdentifier` (string, required)
  - `filePath` (string, required)
  - `content` (string, required)
- **Returns**: `{ success, filePath, absolutePath, bytesWritten, linesWritten, wasExistingFile, message }`

### XcodeUpdate

Edit an existing file with text replacement.

- **Parameters**:
  - `tabIdentifier` (string, required)
  - `filePath` (string, required)
  - `oldString` (string, required) — text to find
  - `newString` (string, required) — replacement text
  - `replaceAll` (boolean, optional, default false) — replace all occurrences
- **Returns**: `{ filePath, editsApplied, success, originalContentLength, modifiedContentLength, message }`
- **Notes**: Single replacement by default. Each `oldString` must be unique unless `replaceAll` is true. Prefer over XcodeWrite for editing existing files.

### XcodeGlob

Find files matching a wildcard pattern.

- **Parameters**:
  - `tabIdentifier` (string, required)
  - `pattern` (string, optional, default `**/*`) — glob pattern
  - `path` (string, optional) — directory to search within
- **Returns**: `{ matches[], pattern, searchPath, truncated, totalFound, message }`

### XcodeGrep

Search file contents with regex.

- **Parameters**:
  - `tabIdentifier` (string, required)
  - `pattern` (string, required) — regex pattern
  - `glob` (string, optional) — file pattern filter
  - `path` (string, optional) — directory scope
  - `type` (string, optional) — file type filter
  - `ignoreCase` (boolean, optional)
  - `multiline` (boolean, optional)
  - `outputMode` (enum, optional) — `content`, `filesWithMatches`, `count`
  - `linesContext` (integer, optional) — context lines
  - `linesBefore` (integer, optional)
  - `linesAfter` (integer, optional)
  - `headLimit` (integer, optional) — max results
  - `showLineNumbers` (boolean, optional)
- **Returns**: `{ results[], pattern, searchPath, matchCount, truncated, message }`
- **Notes**: Mirrors ripgrep's interface. Use `outputMode` to control result format.

### XcodeLS

List directory contents.

- **Parameters**:
  - `tabIdentifier` (string, required)
  - `path` (string, required)
  - `recursive` (boolean, optional, default true)
  - `ignore` (array of strings, optional) — patterns to skip
- **Returns**: `{ items[], path }`

### XcodeMakeDir

Create a directory in the project.

- **Parameters**:
  - `tabIdentifier` (string, required)
  - `directoryPath` (string, required)
- **Returns**: `{ success, message, createdPath }`

### XcodeRM

Remove files or directories from project. Uses Trash by default.

- **Parameters**:
  - `tabIdentifier` (string, required)
  - `path` (string, required)
  - `deleteFiles` (boolean, optional, default true) — move to Trash
  - `recursive` (boolean, optional)
- **Returns**: `{ removedPath, success, message }`

### XcodeMV

Move or copy files.

- **Parameters**:
  - `tabIdentifier` (string, required)
  - `sourcePath` (string, required)
  - `destinationPath` (string, required)
  - `operation` (enum, optional) — `move` or `copy`
  - `overwriteExisting` (boolean, optional)
- **Returns**: `{ success, operation, message, sourceOriginalPath, destinationFinalPath }`
- **Notes**: Can copy, not just move. May break imports — confirm with user.

---

## Build & Test

### BuildProject

Build the project and wait for completion.

- **Parameters**:
  - `tabIdentifier` (string, required)
- **Returns**: `{ buildResult, elapsedTime, errors[] }`
- **Notes**: Each error has `classification`, `filePath`, `lineNumber`, `message`.

### GetBuildLog

Retrieve build log with optional filtering.

- **Parameters**:
  - `tabIdentifier` (string, required)
  - `severity` (enum, optional) — `remark`, `warning`, `error`
  - `pattern` (string, optional) — regex filter
  - `glob` (string, optional) — file pattern filter
- **Returns**: `{ buildIsRunning, buildLogEntries[], buildResult, fullLogPath, truncated, totalFound }`
- **Notes**: Returns structured entries, not raw text. Each entry has `buildTask` and `emittedIssues[]`.

### RunAllTests

Run the full test suite from the active scheme's test plan.

- **Parameters**:
  - `tabIdentifier` (string, required)
- **Returns**: `{ summary, counts, results[], schemeName, activeTestPlanName }`
- **Notes**: `counts` has `total`, `passed`, `failed`, `skipped`, `expectedFailures`, `notRun`. Each result has `targetName`, `identifier`, `displayName`, `state`.

### RunSomeTests

Run specific tests by identifier.

- **Parameters**:
  - `tabIdentifier` (string, required)
  - `tests` (array, required) — each element: `{ targetName: string, testIdentifier: string }`
- **Returns**: Same shape as RunAllTests
- **Notes**: Use `GetTestList` to discover valid test identifiers.

### GetTestList

List available tests from the active test plan.

- **Parameters**:
  - `tabIdentifier` (string, required)
- **Returns**: `{ tests[], schemeName, activeTestPlanName }`
- **Notes**: Each test has `targetName`, `identifier`, `displayName`, `isEnabled`, `filePath`, `lineNumber`, `tags[]`.

---

## Diagnostics

### XcodeListNavigatorIssues

Get issues from Xcode's Issue Navigator.

- **Parameters**:
  - `tabIdentifier` (string, required)
  - `severity` (enum, optional) — `remark`, `warning`, `error`
  - `pattern` (string, optional) — regex filter
  - `glob` (string, optional) — file pattern filter
- **Returns**: `{ issues[], truncated, totalFound, message }`
- **Notes**: Each issue has `message`, `severity`, `path`, `line`, `category`, `vitality` (fresh/stale). Structured and deduplicated.

### XcodeRefreshCodeIssuesInFile

Refresh diagnostics for a specific file.

- **Parameters**:
  - `tabIdentifier` (string, required)
  - `filePath` (string, required)
- **Returns**: `{ filePath, diagnosticsCount, content, success }`
- **Notes**: Triggers Xcode to re-analyze the file.

---

## Execution & Rendering

### RunCodeSnippet

Build and run a code snippet in the context of a source file.

- **Parameters**:
  - `codeSnippet` (string, **required**) — code to execute
  - `sourceFilePath` (string, **required**) — Swift file whose context the snippet runs in (has access to its `fileprivate` declarations)
  - `purpose` (string, **required**) — short human-readable reason for the run. Apple's schema explicitly forbids the word "test" here, because it misleads the user into thinking this is a testing feature.
  - `tabIdentifier` (string, optional)
  - `timeout` (integer, optional, default **600**) — seconds
- **Returns**: `{ executionResults }` — console output from print statements
- **Notes**: Not a generic REPL. Runs in the context of a specific file. No `language` parameter — Swift only. Available only for source files in targets that build apps, frameworks, libraries, or command-line executables.

**Renamed.** This tool was `ExecuteSnippet` in earlier Xcode 27 betas. Calling `ExecuteSnippet` now fails — the name does not exist on the server (verified against `xcode-tools` 25280.8, Xcode 27A5237l).

### RenderPreview

Render a SwiftUI preview snapshot.

- **Parameters**:
  - `tabIdentifier` (string, required)
  - `sourceFilePath` (string, required) — Swift file with `#Preview`
  - `previewDefinitionIndexInFile` (integer, optional, default 0) — zero-based index of which `#Preview` to render
  - `timeout` (integer, optional, default 120)
- **Returns**: `{ previewSnapshotPath }` — path to rendered image
- **Notes**: Index-based, not name-based. First `#Preview` in the file is index 0.

---

## Search

### DocumentationSearch

Search Apple Developer Documentation semantically.

- **Parameters**:
  - `query` (string, required)
  - `frameworks` (array of strings, optional) — scope to specific frameworks
- **Returns**: `{ documents[] }` — each with `title`, `uri`, `contents`, `score`
- **Notes**: Local semantic search (MLX-accelerated), not web search.

---

## Quick Reference

| Category | Tools |
|----------|-------|
| **Discovery** | `XcodeListWindows` |
| **File Read** | `XcodeRead`, `XcodeGlob`, `XcodeGrep`, `XcodeLS` |
| **File Write** | `XcodeWrite`, `XcodeUpdate`, `XcodeMakeDir` |
| **File Destructive** | `XcodeRM`, `XcodeMV` |
| **Build** | `BuildProject`, `GetBuildLog` |
| **Test** | `RunAllTests`, `RunSomeTests`, `GetTestList` |
| **Diagnostics** | `XcodeListNavigatorIssues`, `XcodeRefreshCodeIssuesInFile` |
| **Execution** | `RunCodeSnippet` |
| **Preview** | `RenderPreview` |
| **Search** | `DocumentationSearch` |

### Documented here vs. what the server exposes

The sections above cover **20 of the 53 tools** the Xcode MCP server advertises (`xcode-tools` 25280.8, Xcode 27A5237l). The undocumented 33 are real and callable — enumerate them yourself with `tools/list` rather than assuming this page is exhaustive:

| Group | Tools not yet documented here |
|---|---|
| Device interaction | `DeviceInteractionStartSession`, `DeviceInteractionStartWorkspaceSession`, `DeviceInteractionInstallAndRun`, `DeviceInteractionSynthesize`, `DeviceInteractionEndSession` |
| Run control & console | `RunProject`, `StopProject`, `GetConsoleOutput` |
| Crash & field performance | `GetTopCrashIssues`, `GetCrashIssueLogs`, `GetTopFieldPerformanceIssues`, `GetFieldPerformanceIssueLogs` |
| Scheme / destination / test plan | `XcodeListSchemes`, `XcodeSwitchScheme`, `XcodeListRunDestinations`, `XcodeSwitchRunDestination`, `XcodeListTestPlans`, `XcodeSwitchTestPlan` |
| Targets & templates | `XcodeListTargets`, `XcodeListTemplates`, `XcodeNewTarget` |
| Build settings & flags | `GetTargetBuildSettings`, `UpdateTargetBuildSetting`, `GetFileCompilerFlags`, `UpdateFileCompilerFlags` |
| Project config | `AddEntitlement`, `AddInfoPlist` |
| Localization | `LocalizationPlanner`, `StringCatalogRead`, `StringCatalogEdit`, `StringCatalogContext` |
| Editor state | `XcodeGetCurrentFile` |
| Debugger | `InvokeDebuggerCommand` |

## Common Parameter Patterns

- **`tabIdentifier`** — Required by most of the 20 tools documented above. Always call `XcodeListWindows` first.
- **`filePath`** — Used by XcodeRead, XcodeWrite, XcodeUpdate, XcodeRefreshCodeIssuesInFile. Project-relative or absolute.
- **`path`** — Used by XcodeLS, XcodeRM, XcodeGlob. Directory path.
- **`directoryPath`** — Used by XcodeMakeDir.
- **`sourceFilePath`** — Used by RunCodeSnippet, RenderPreview. Must be a Swift source file.

## Resources

**Skills**: axiom-xcode-mcp (skills/xcode-mcp-setup.md), axiom-xcode-mcp (skills/xcode-mcp-tools.md)
