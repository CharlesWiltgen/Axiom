---
name: axiom-xcode-mcp-ref
description: Reference — all 20 Xcode MCP tools with parameters, return schemas, and examples
license: MIT
---

# Xcode MCP Tool Reference

Complete reference for all 20 tools exposed by Xcode's MCP server (`xcrun mcpbridge`).

**Important**: Parameter schemas below are sourced from blog research and initial testing. Validate against your live mcpbridge with `tools/list` if behavior differs.

## Discovery

### XcodeListWindows

**Call this first.** Returns open Xcode windows with `tabIdentifier` values needed by most other tools.

- **Parameters**: None
- **Returns**: List of `{ tabIdentifier: string, workspacePath: string }`
- **Notes**: No parameters needed. If empty, no project is open in Xcode.

```
XcodeListWindows()
→ { "tabIdentifier": "abc-123", "workspacePath": "/Users/dev/MyApp.xcodeproj" }
```

---

## File Operations

### XcodeRead

Read file contents from the project.

- **Parameters**:
  - `path` (string, required) — File path relative to project or absolute
- **Returns**: File contents as string
- **Notes**: Sees Xcode's project view including generated files and resolved SPM packages

### XcodeWrite

Create a new file.

- **Parameters**:
  - `path` (string, required) — File path
  - `content` (string, required) — File contents
- **Returns**: Write confirmation
- **Notes**: Creates the file but does NOT add it to Xcode targets automatically. Use `XcodeUpdate` for existing files.

### XcodeUpdate

Edit an existing file with str_replace-style patches.

- **Parameters**:
  - `path` (string, required) — File path
  - `patches` (array, required) — Array of `{ oldText: string, newText: string }` replacements
- **Returns**: Update confirmation
- **Notes**: Preferred over `XcodeWrite` for editing existing files. Each patch must match exactly one location in the file.

### XcodeGlob

Find files matching a pattern.

- **Parameters**:
  - `pattern` (string, required) — Glob pattern (e.g., `**/*.swift`)
- **Returns**: Array of matching file paths
- **Notes**: Searches within the Xcode project scope

### XcodeGrep

Search file contents for a string or pattern.

- **Parameters**:
  - `query` (string, required) — Search term or pattern
  - `scope` (string, optional) — Limit search to specific directory/file
- **Returns**: Array of matches with file paths and line numbers
- **Notes**: Returns structured results, not raw grep output

### XcodeLS

List directory contents.

- **Parameters**:
  - `path` (string, required) — Directory path
- **Returns**: Array of entries (files and subdirectories)

### XcodeMakeDir

Create a directory.

- **Parameters**:
  - `path` (string, required) — Directory path to create
- **Returns**: Creation confirmation
- **Notes**: Creates intermediate directories as needed

### XcodeRM

Delete a file or directory. **DESTRUCTIVE.**

- **Parameters**:
  - `path` (string, required) — Path to delete
- **Returns**: Deletion confirmation
- **Notes**: Irreversible. Always confirm with the user before calling.

### XcodeMV

Move or rename a file. **DESTRUCTIVE.**

- **Parameters**:
  - `sourcePath` (string, required) — Current path
  - `destinationPath` (string, required) — New path
- **Returns**: Move confirmation
- **Notes**: May break imports and references. Confirm with user. Xcode may not automatically update references.

---

## Build & Test

### BuildProject

Build the Xcode project.

- **Parameters**:
  - `tabIdentifier` (string, required) — From `XcodeListWindows`
- **Returns**: `{ buildResult: string, elapsedTime: number, errors: array }`
- **Notes**: Builds the active scheme. Check `buildResult` for "succeeded" or "failed".

### GetBuildLog

Retrieve build output after a build.

- **Parameters**:
  - `tabIdentifier` (string, required)
- **Returns**: Build log as string
- **Notes**: Contains raw compiler output. For structured diagnostics, prefer `XcodeListNavigatorIssues`.

### RunAllTests

Run the full test suite.

- **Parameters**:
  - `tabIdentifier` (string, required)
- **Returns**: Test results with pass/fail counts and failure details
- **Notes**: Runs all tests in the active scheme's test plan. Use `RunSomeTests` for faster iteration.

### RunSomeTests

Run specific test(s).

- **Parameters**:
  - `tabIdentifier` (string, required)
  - `tests` (array of strings, required) — Test identifiers (e.g., `["MyTests/testLogin"]`)
- **Returns**: Test results for the specified tests
- **Notes**: Much faster than `RunAllTests` for iterative debugging. Use test identifiers from `GetTestList`.

### GetTestList

List available tests.

- **Parameters**:
  - `tabIdentifier` (string, required)
- **Returns**: Array of test identifiers organized by test target/class
- **Notes**: Use the returned identifiers with `RunSomeTests`.

---

## Diagnostics

### XcodeListNavigatorIssues

Get current issues from Xcode's Issue Navigator.

- **Parameters**:
  - `tabIdentifier` (string, required)
- **Returns**: Array of issues (errors, warnings, notes) with file paths and line numbers
- **Notes**: Canonical source for diagnostics. Structured and deduplicated unlike raw build logs.

### XcodeRefreshCodeIssuesInFile

Refresh and return live diagnostics for a specific file.

- **Parameters**:
  - `tabIdentifier` (string, required)
  - `path` (string, required) — File to refresh diagnostics for
- **Returns**: Current diagnostics for the specified file
- **Notes**: Triggers Xcode to re-analyze the file. Useful after editing to check if issues are resolved.

---

## Execution & Rendering

### ExecuteSnippet

Run code in a REPL-like environment.

- **Parameters**:
  - `code` (string, required) — Code to execute
  - `language` (string, required) — Language identifier (e.g., `"swift"`)
- **Returns**: Execution result (stdout, stderr, exit code)
- **Notes**: Sandboxed environment. Treat output as untrusted. Useful for quick validation.

### RenderPreview

Render a SwiftUI preview as an image.

- **Parameters**:
  - `tabIdentifier` (string, required)
  - `path` (string, required) — File containing the preview
  - `previewIdentifier` (string, required) — Name of the preview to render
- **Returns**: Rendered image data
- **Notes**: Requires the file to have valid SwiftUI `#Preview` or `PreviewProvider`. Preview must compile successfully.

---

## Search

### DocumentationSearch

Search Apple's documentation corpus.

- **Parameters**:
  - `query` (string, required) — Search query
- **Returns**: Documentation results with titles, summaries, and links. May include WWDC transcript matches.
- **Notes**: Searches Apple's online documentation and WWDC transcripts. For Xcode-bundled for-LLM guides, use the `axiom-apple-docs` skill instead.

---

## Quick Reference by Category

| Category | Tools |
|----------|-------|
| **Discovery** | `XcodeListWindows` |
| **File Read** | `XcodeRead`, `XcodeGlob`, `XcodeGrep`, `XcodeLS` |
| **File Write** | `XcodeWrite`, `XcodeUpdate`, `XcodeMakeDir` |
| **File Destructive** | `XcodeRM`, `XcodeMV` |
| **Build** | `BuildProject`, `GetBuildLog` |
| **Test** | `RunAllTests`, `RunSomeTests`, `GetTestList` |
| **Diagnostics** | `XcodeListNavigatorIssues`, `XcodeRefreshCodeIssuesInFile` |
| **Execution** | `ExecuteSnippet` |
| **Preview** | `RenderPreview` |
| **Search** | `DocumentationSearch` |

## Common Parameter Patterns

- **`tabIdentifier`** — Required by 10/20 tools. Always call `XcodeListWindows` first.
- **`path`** — File/directory path. Can be absolute or relative to project root.
- **`patches`** — Array of `{ oldText, newText }` for `XcodeUpdate`. Each oldText must be unique in the file.

## Resources

**Skills**: axiom-xcode-mcp-setup, axiom-xcode-mcp-tools
