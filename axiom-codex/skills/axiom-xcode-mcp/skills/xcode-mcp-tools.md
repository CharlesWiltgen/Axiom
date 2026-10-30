
# Xcode MCP Tool Workflows

**Core principle**: Xcode MCP gives you programmatic IDE access. Use workflow loops, not isolated tool calls.

## Workspace Targeting (Critical Foundation)

Most tools require a `workspaceIdentifier`. **Always call `XcodeListWorkspaces` first.**

```
1. XcodeListWorkspaces → list of (workspaceIdentifier, workspacePath) pairs
2. Match workspacePath to your project
3. Pass that workspaceIdentifier on every subsequent tool call
```

Real output — the identifier is a readable slug, not a UUID:

```
* workspaceIdentifier: workspace-Gxw7GRzGoI, workspacePath: /path/to/MyApp.xcodeproj
```

**It is required even when only one workspace is open.** The parameter is absent from every
tool's `required` list except `XcodeCloseWorkspace`'s, so it looks optional — it isn't. Calling `XcodeListSchemes` with no
arguments against a single open workspace returns:

```
Error: workspaceIdentifier is required for this action. Choose from the following open
workspaces, or open one with XcodeOpenWorkspace:
* workspaceIdentifier: workspace-Gxw7GRzGoI, workspacePath: /path/to/MyApp.xcodeproj
```

The error is self-documenting — it names the valid identifiers — so a missed identifier costs
one round trip, not a silent wrong-target write.

**Cache the mapping** for the session. Only re-fetch if a call reports an unknown identifier,
or you opened/closed a workspace.

## Workspace Bootstrap

Under the Xcode 27 headless server there may be no workspace open at all, and no human to open
one. `XcodeListWorkspaces` returning `No workspaces are currently open.` is a normal starting
state, not an error.

```
1. XcodeListWorkspaces → empty?
2a. Existing project → XcodeOpenWorkspace(path: "/abs/path/MyApp.xcodeproj")
2b. New project     → XcodeListTemplates → XcodeNewProject(...)
3. Use the returned workspaceIdentifier for everything after
```

`XcodeOpenWorkspace` takes an **absolute** path to a `.xcworkspace` or `.xcodeproj` (not a
`Package.swift`) and returns the session context in one call:

```json
{"activeRunDestination":"My Mac","activeScheme":"HeadlessProbe",
 "workspaceIdentifier":"workspace-Gxw7GRzGoI","workspacePath":"/path/to/HeadlessProbe.xcodeproj"}
```

`XcodeNewProject` requires `templateIdentifier`, `productName`, and `destinationPath` — note
`productName`, not `projectName`, and `destinationPath`, not `outputPath`. Wrong names return
`The data couldn't be read because it is missing.` Discover templates with `XcodeListTemplates`,
which truncates inline results to 100 of 193 and writes the full list to a temp file whose path
it returns; inline `options` arrays are empty until you pass a filter or `templateIdentifier`.

`XcodeCloseWorkspace` releases the session when you're done.

## Workflow: BuildFix Loop

Iteratively build, diagnose, and fix until the project compiles.

```
1. BuildProject(workspaceIdentifier)
2. Check buildResult — if success, done
3. GetBuildLog(workspaceIdentifier, severity: "error") → project-wide diagnostics
4. XcodeRefreshCodeIssuesInFile(workspaceIdentifier, filePath) → per-file detail where needed
5. XcodeUpdate(filePath, oldString, newString) for each diagnostic
6. Go to step 1 (max 5 iterations)
7. If same error persists after 3 attempts → fall back to axiom-build (skills/xcode-debugging.md)
```

**Filter the build log, don't parse it raw**: `GetBuildLog` takes `severity` (errors only, or
warnings and above), plus `pattern` (regex against the message) and `glob` (against the issue
path). Filtering server-side is what makes the log usable — an unfiltered log is raw compiler
output with noise.

**Project-wide vs per-file**: `GetBuildLog` is the project-wide diagnostics source.
`XcodeRefreshCodeIssuesInFile` **requires** `filePath` and returns current compiler diagnostics
for that one file — use it to re-check a file you just patched without a full rebuild.

**When to fall back to `axiom-build (skills/xcode-debugging.md)`**: When the error is environmental (zombie processes, stale Derived Data, simulator issues) rather than code-level. MCP tools operate on code; environment issues need CLI diagnostics.

## Workflow: TestFix Loop

Fast iteration on failing tests.

```
1. GetTestList(workspaceIdentifier) → discover available tests
2. RunSomeTests(workspaceIdentifier, tests: [{targetName, testIdentifier}, ...])
3. Parse failures → identify code to fix
4. XcodeUpdate(filePath, oldString, newString) to patch code
5. Go to step 2 (max 5 iterations per test)
6. RunAllTests(workspaceIdentifier) as final verification
```

**No coverage tool is listed.** The 27.2 beta 2 and RC release notes announced
`GetCodeCoverage`, but the 27.2 release notes dropped it and no listing through the released
27.2 (27B52) includes it — see `axiom-xcode-mcp (skills/xcode-mcp-setup.md)`.
Don't call it or invent parameters unless the live `tools/list` shows its schema.

**Why `RunSomeTests` first**: Running a single test takes seconds. Running all tests takes minutes. Iterate on the failing test, then verify the full suite once it passes.

**`tests` is an array of specifiers**, each with `targetName` and `testIdentifier` — not bare
test names. Source them from `GetTestList`.

**`GetTestList` caps inline output at 100 tests** and writes the complete list to
`fullTestListPath` in grep-friendly form. On a large suite, grep that file for `TEST_TARGET`,
`TEST_IDENTIFIER`, or `TEST_FILE_PATH` rather than assuming the inline list is everything.

**Parsing test results**: Read `counts.failed`, then each `results[]` entry's `state` and `errorMessages` (plain strings). `results` lists failures first and truncates at 100; `fullSummaryPath` holds the complete summary.

## Workflow: PreviewVerify

Render SwiftUI previews and verify UI changes visually.

```
1. RenderPreview(workspaceIdentifier, sourceFilePath, previewDefinitionIndexInFile: 0) → image path
2. Review the rendered image for correctness
3. If making changes: XcodeUpdate → RenderPreview again
4. Compare before/after for regressions
```

**Use cases**: Verifying layout changes, checking dark mode appearance, confirming Liquid Glass effects render correctly.

**Read the image path from the build's output schema.** Xcode 27.2 (27B52; RC 27B48) returns it as
`snapshot.path` and groups every supported override under `supportedOverrides`
(`canvasControls`, `localizations`, `previewVariants`, `renderDestinations`, `displayModes`).
Earlier 27 builds return `previewSnapshotPath` and top-level `supportedLocalizations`,
`supportedPreviewVariantOverrides`, and `supportedCanvasControlOverrides` — a client reading
the old names finds no snapshot path or override lists on the 27.2 RC and release. The per-build table is in
`axiom-xcode-mcp (skills/xcode-mcp-ref.md)`.

`RenderPreview` also takes `previewLocalizationOverride` (a locale identifier), `previewVariantOverrides`, and `previewCanvasControlOverrides` — use values returned by a previous invocation rather than guessing, and don't run calls in parallel while passing a localization override. Default `timeout` is 120s.

### Capture an Interactive Preview on Xcode 27.2

Xcode 27.2 (from the RC) adds `displayMode`: `static` (the default) captures a static snapshot;
`interactive` runs the preview, then captures it after `snapshotDelay` seconds. Pass only a
mode listed in a prior call's `supportedOverrides.displayModes`. `snapshotDelay` is an
integer, counts against `timeout`, and must be at least 0 and less than `timeout`, or the
call fails. Builds before the 27.2 RC have neither input.

### Choose a Render Destination

**Check the live schema first.** Xcode 27.2 (RC and release) returns destinations in
`supportedOverrides.renderDestinations`; 27.2 beta 2 (27B5028f) returns them in
`availableRenderDestinations`. Both accept `preferredRenderDestination`. The 27.1 RC
(27A9275) has neither; use automatic rendering on that build.

First call `RenderPreview` without a preference. Use your project's workspace identifier
and source path in both examples:

```json
{
  "workspaceIdentifier": "workspace-Gxw7GRzGoI",
  "sourceFilePath": "MyApp/ContentView.swift",
  "previewDefinitionIndexInFile": 0
}
```

If destinations are returned, select an entry and use its exact `identifier` in a subsequent
`RenderPreview` call for the same active scheme. Replace the placeholder below with that
returned identifier:

```json
{
  "workspaceIdentifier": "workspace-Gxw7GRzGoI",
  "sourceFilePath": "MyApp/ContentView.swift",
  "previewDefinitionIndexInFile": 0,
  "preferredRenderDestination": {
    "identifier": "identifier-from-renderDestinations"
  }
}
```

You can also constrain `platformName`, `deviceModelName`, and `systemVersion` using returned
values; all specified fields must match. If destinations are unavailable, keep automatic
selection. The schema specifies automatic fallback plus an `errors` message when a preference
matches nothing. On every 27.2 build (beta 2, RC, release) `errors` is required by the output schema, and when the
optional `renderedDestination` object is present it includes a required `identifier`. Compare
that identifier with the selection and inspect errors to confirm the result.

For argument-based previews on 27.2 builds, `groupItems` (under
`supportedOverrides.canvasControls` on the RC and release, `supportedCanvasControlOverrides` on beta 2)
contains objects with required integer `index` and optional string `title`. Use the returned
`index` as `previewCanvasControlOverrides.groupItemIndex`; titles can repeat. The group-items
array can be omitted when the control is unavailable. The 27.1 RC declares integer entries
instead.

## Workflow: Debugger Inspection

Start with a debugger-attached process (`RunProject` with `attachDebugger: true` if needed).
Use `InvokeDebuggerCommand` with `command: "process status"` to check the process state before
issuing commands that require it to be stopped, unless that state is already known.
From 27.2 beta 2 the tool's description recommends `p` or `v` for variable inspection. Use `po` or
`expression` when you need function calls, casts, or arithmetic. These are LLDB commands
inside the `command` parameter, not additional MCP tools.

## Workflow: IssueTriage

Collect diagnostics from the build, then drill into individual files.

```
1. GetBuildLog(workspaceIdentifier, severity: "error") → project-wide errors
2. Widen to warnings once errors are clear; narrow with pattern or glob
3. For a specific file: XcodeRefreshCodeIssuesInFile(workspaceIdentifier, filePath)
4. Fix errors first, rebuild, re-check
```

**Why this over grep-for-errors**: these are Xcode's live compiler diagnostics — type-check errors, missing imports, and constraint issues that only the compiler frontend surfaces — with severity filtering applied before the response is built.

## Workflow: DocumentationSearch

Query Apple's documentation corpus through MCP.

```
1. DocumentationSearch(query, frameworks: ["SwiftUI"]) → documentation results
2. Cross-reference with axiom-apple-docs for bundled Xcode guides
```

**Check that the tool is listed before calling it.** The server advertises
`capabilities.tools.listChanged: true`. The released 27.2 (27B52), the 27.2 RC, the released 27.0 and
its beta 6 list all 54 tools with no workspace open, including `DocumentationSearch`; the 27.1 RC (27A9275)
lists it too. On 27.2 beta 2 (27B5028f), `DocumentationSearch` is absent from both the
unapproved/no-workspace and approved/with-workspace captures. A shorter list alone does not
establish a workspace or approval problem. Re-list and check the selected Xcode/build and
`xcrun mcp-server status`. When the tool is unavailable, use `axiom-apple-docs` for bundled
guides and SDK-first Apple documentation research.

`query` is required; `frameworks` is an optional array that scopes the search (all frameworks if omitted). Matching is semantic, not keyword.

**Note**: `DocumentationSearch` searches Apple's online documentation and WWDC transcripts. For the 20 for-LLM guides bundled inside Xcode, use `axiom-apple-docs` instead.

## File Operations via MCP

### Reading and Writing

| Operation | Tool | Notes |
|-----------|------|-------|
| Read file contents | `XcodeRead` | Sees Xcode's project view (generated files, resolved packages) |
| Create new file | `XcodeWrite` | Writes `content` to `filePath` — auto-adds to project structure. Overwrites wholesale if the file exists |
| Edit existing file | `XcodeUpdate` | str_replace-style patches — safer than full rewrites |
| Search for files | `XcodeGlob` | Pattern matching within the project |
| Search file contents | `XcodeGrep` | Content search with line numbers |
| List directory | `XcodeLS` | Directory listing |
| Create directory | `XcodeMakeDir` | Synchronized (buildable) folder by default; `directoryKind: "group"` (27.2) for a classic group. Falls back to what the parent supports |

### Destructive Operations (Require Confirmation)

| Operation | Tool | Risk |
|-----------|------|------|
| Delete file/directory | `XcodeRM` | Moves to Trash by default (`deleteFiles: true`) — confirm with user |
| Move/rename file | `XcodeMV` | May break imports and references |

**Always confirm destructive operations with the user** before calling `XcodeRM` or `XcodeMV`.

### When to Use MCP File Tools vs Standard Tools

| Scenario | Use MCP | Use Standard (Read/Write/Grep) |
|----------|---------|-------------------------------|
| Files in the Xcode project view | Yes — includes generated/resolved files | May miss generated files |
| Files outside the project | No | Yes — standard tools work everywhere |
| Need build context (diagnostics after edit) | Yes — edit + rebuild in one workflow | No build integration |
| Simple file read/edit | Either works | Slightly faster (no MCP overhead) |

## Code Snippets

### Execute Swift Code

```
RunCodeSnippet(workspaceIdentifier, codeSnippet: "print(MyModel.self)", sourceFilePath: "Sources/MyModel.swift", purpose: "inspect the model type")
```

Runs code in the context of a specific Swift file — has access to that file's `fileprivate` declarations. Not a generic REPL. No `language` parameter (Swift only).

`purpose` is **required**, and Apple's schema forbids the word "test" in it. The tool was named `ExecuteSnippet` in earlier 27 betas; that name no longer resolves.

## Gotchas and Anti-Patterns

### An Unapproved Agent Is Rejected `OS27`

Until an agent identity is approved, every `tools/call` fails with *"This agent isn't approved to
use Xcode's tools yet. Call XcodeOpenWorkspace or XcodeNewProject first…"* — while `initialize`
and `tools/list` still succeed, so a full tool list does not mean you can call anything. (Xcode 27
beta 5 and earlier hung on the call instead of failing.)

**Pre-flight check**: before issuing tool calls, confirm your agent appears in
`xcrun mcp-server status` under `Permitted agents`. If it doesn't, call `XcodeOpenWorkspace` or
`XcodeNewProject` to raise the approval prompt on the host, or `sudo xcrun mcp-server approve <id>`.

**Unsigned agents can't hold durable trust.** Clicking "Always allow" for a shell-launched client
still yields a ~24-hour grant, matching `approve --help` ("`--always` — signed agents and folders
only"). Re-approval is the steady state; don't treat the re-prompt as a bug. Durable options: run the
client from a signed binary, or — only on an isolated machine — `sudo xcrun mcp-server enable
--unsafe-always-allow-all-agents`, which approves every agent indefinitely (see
`skills/xcode-mcp-setup.md` for the risk).

### Workspace Identifier Staleness

Workspace identifiers become invalid when the workspace is closed (`XcodeCloseWorkspace`), or the
headless server is restarted (`mcp-server stop`, then `mcp-server open <path>`).

**Fix**: Re-call `XcodeListWorkspaces` to get fresh identifiers. The "required" error also lists
the currently valid ones, so a stale call is self-correcting.

### XcodeWrite vs XcodeUpdate

- `XcodeWrite` — **writes** `content` to `filePath`. If the file exists it is overwritten entirely; there is no create-only mode.
- `XcodeUpdate` — **patches** an existing file with `oldString`/`newString` replacement. One replacement per call (use `replaceAll: true` for all occurrences).

**Common mistake**: Using `XcodeWrite` to edit an existing file overwrites its entire contents. Use `XcodeUpdate` for edits.

### Schema Compliance (Xcode 26.x only)

On Xcode 26.x, mcpbridge populated `content` but omitted `structuredContent` for tools declaring
`outputSchema`, breaking strict MCP clients (Cursor, some Zed configurations). The workaround was
[XcodeMCPWrapper](https://github.com/SoundBlaster/XcodeMCPWrapper) as a proxy.

**Fixed on Xcode 27** — every tool declares `outputSchema` and responses carry
`structuredContent`. Don't add the proxy on 27; if a strict client still rejects responses, the
cause is something else.

### Build After File Changes

After `XcodeUpdate`, the project may need a build to surface new diagnostics. Don't assume edits are correct without rebuilding.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll just use xcodebuild" | MCP gives IDE state + navigator diagnostics + previews that CLI doesn't |
| "Read tool works fine for Xcode files" | `XcodeRead` sees Xcode's project view including generated files and resolved packages |
| "Skip the identifier, I only have one project" | `workspaceIdentifier` is required even with one workspace open, despite being absent from almost every tool's `required` list. Call `XcodeListWorkspaces` first. |
| "No workspace is open, so MCP is broken" | Normal headless starting state. `XcodeOpenWorkspace` or `XcodeNewProject` — don't ask the user to open Xcode. |
| "tools/list worked, so I'm approved" | `tools/list` is not gated; only `tools/call` checks approval. Confirm your agent under `Permitted agents` first. |
| "Run all tests every time" | `RunSomeTests` for iteration, `RunAllTests` for verification — saves minutes per cycle |
| "I'll parse the build log for errors" | `GetBuildLog` filters by `severity`, `pattern`, and `glob` server-side — filter, don't post-process |
| "XcodeWrite to update a file" | `XcodeUpdate` for edits. `XcodeWrite` creates/overwrites. Wrong tool = data loss. |
| "One tool call is enough" | Workflows (BuildFix, TestFix) use loops. Isolated calls miss the iteration pattern. |

## Resources

**Skills**: axiom-xcode-mcp (skills/xcode-mcp-setup.md), axiom-xcode-mcp (skills/xcode-mcp-ref.md), axiom-build (skills/xcode-debugging.md)
