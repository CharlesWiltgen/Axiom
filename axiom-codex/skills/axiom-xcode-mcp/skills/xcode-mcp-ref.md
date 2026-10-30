
# Xcode MCP Tool Reference

Complete reference for every tool exposed by Xcode's MCP server. `xcrun mcpbridge` is the stdio
transport; on Xcode 27 the service behind it can run headless (`xcrun mcp-server`) — see
`axiom-xcode-mcp (skills/xcode-mcp-setup.md)`.

**Source**: live `tools/list` on the released Xcode 27.2 (27B52, `serverInfo` 25464), 54 tools,
captured headless by an unapproved agent with no workspace open — byte-identical to the 27.2 RC
(27B48, `serverInfo` 25463). Entries describe that schema.

**Earlier builds differ.** The released 27.0 (27A266a), beta 6 and the 27.1 RC (27A9275,
`serverInfo` 25320) share one 54-tool schema set. 27.2 beta 2 (27B5028f, `serverInfo` 25447.1)
lists 53 — `DocumentationSearch` is absent from both its unapproved/no-workspace and
approved/with-workspace captures — and first adds `RenderPreview` destination selection and
`InvokeDebuggerCommand`'s `p`/`v` guidance. From the 27.2 RC, `RenderPreview` adds display
modes and regroups its output, `XcodeMakeDir` adds `directoryKind`, and `AddInfoPlist` adds
`dictionary`.
Entry notes and the `RenderPreview` table mark build-specific fields. `GetCodeCoverage`,
announced in the 27.2 beta 2 and RC release notes (181141715), is absent from every capture
through the released 27.2 (27B52), and the 27.2 release notes no longer mention it — it did
not ship in 27.2. Check the live `tools/list` before using a tool or a build-specific parameter.

**All 54 tools are listed even with no workspace open** (verified on beta 6, the 27.0 SDK and
the 27.2 RC and release: `tools/list` returned 54, `DocumentationSearch` included, with no
workspace open).
The server does advertise `capabilities.tools.listChanged: true`, so treat the set as
dynamic rather than fixed — but do not read a short list as "open a workspace".

**`workspaceIdentifier` is required in practice wherever tested** — even when only one workspace
is open, and even though only `XcodeCloseWorkspace` lists it as `required`. 46 of the 54 tools accept it;
omitting it on `XcodeListSchemes` and `XcodeListTargets` returned an error naming the valid
identifiers, so assume the same for the rest rather than treating its absence from `required` as
permission to skip it:

```
Error: workspaceIdentifier is required for this action. Choose from the following open
workspaces, or open one with XcodeOpenWorkspace:
* workspaceIdentifier: workspace-Gxw7GRzGoI, workspacePath: /path/to/MyApp.xcodeproj
```

Get identifiers from `XcodeListWorkspaces`. They are readable slugs (`workspace-Gxw7GRzGoI`), not
UUIDs.

**`tabIdentifier` is gone as of beta 6 — but it was still live in beta 5.** Xcode 27 briefly served two
different tool surfaces from the same `xcrun mcpbridge` command, depending on whether Xcode.app was
running: with Xcode up, beta 5 returned 53 tools addressed by `tabIdentifier` (plus `XcodeListWindows`,
`XcodeGetCurrentFile`, `XcodeListNavigatorIssues`); with Xcode closed, the headless service returned the
54-tool workspace surface documented here. Beta 6 converged them — the running-Xcode path now serves the
workspace surface too, `tabIdentifier` appears in **zero** tools, and the three window/editor-centric
tools are gone. Code written against a beta-5 running-Xcode capture will break.

**Reading the entries below**: `*` marks required fields. `(+ workspaceIdentifier)` on the Params
line means the tool accepts it; it is omitted from each list to avoid repeating it 46 times.
`Returns` fields come from each tool's `outputSchema`. All 54 declare one and responses carry
`structuredContent`, but one declares an **empty** schema (`UpdateTargetBuildSetting`) — its
entry has no `Returns` line, which means "no structured fields", not "undocumented".

Apple's own spelling is preserved even where inconsistent: `DeviceInteractionSynthesize` takes
`interactSessionKey` while `DeviceInteractionInstallAndRun` and `DeviceInteractionEndSession` take
`interactionSessionKey`. That is verbatim from the schema — do not "correct" it.

---

## Workspaces & Projects

### XcodeListWorkspaces

Lists the workspaces currently open in Xcode, with the identifier and path of each.

- **Params**: none

- **Returns**: `message`*

### XcodeOpenWorkspace

Opens an Xcode workspace or project at the given path and returns its workspace identifier, which other tools can use to target it.

- **Params**: `path`* — Absolute path to the .xcworkspace or .xcodeproj to open

- **Returns**: `workspaceIdentifier`*, `activeRunDestination`, `activeScheme`, `message`, `workspacePath`

- **Notes**: `path` must be absolute and point at a `.xcworkspace` or `.xcodeproj`; a `Package.swift` does not open.

### XcodeCloseWorkspace

Closes a workspace that was opened with XcodeOpenWorkspace, identified by its workspace identifier.

- **Params**: `workspaceIdentifier`* — The identifier of the workspace to close (as returned by XcodeOpenWorkspace or XcodeListWorkspaces)

- **Returns**: `message`*

### XcodeNewProject

Creates a new Xcode project from a template.

- **Params**: `destinationPath`* — Filesystem path to the directory where the project will be created…; `productName`* — The new project's product name (e.g. 'MyApp'); `templateIdentifier`* — Template identifier to instantiate (e.g. 'com.apple.dt.unit.storyboardApplication'); `options` — Optional dictionary of template-specific options; `organizationIdentifier` — Optional bundle identifier prefix (e.g. 'com.example'); `teamIdentifier` — Optional Apple Development Team ID for code signing (e.g. 'A1B2C3D4E5')

- **Returns**: `createdTargets`*, `projectPath`*

- **Notes**: Params are `productName` and `destinationPath` — **not** `projectName`/`outputPath`. Wrong names return `The data couldn't be read because it is missing.`

### XcodeListTemplates

Lists Xcode templates available in this Xcode install.

- **Params**: `categoryFilter` — Optional list of substrings, case-insensitive, matched against the template's templateCategory…; `kind` — Optional template kind to list; `nameFilter` — Optional substring, case-insensitive, matched against the template's human-readable…; `platformFilter` — Optional list of platform identifiers or names (case-insensitive); `templateIdentifier` — Optional exact identifier match (e.g. 'com.apple.dt.unit.iosFramework')

- **Returns**: `fullTemplateListPath`*, `templates`*, `totalTemplates`*, `truncated`*, `message`

- **Notes**: Inline results truncate to 100 of 193; the full list is written to the returned temp path. Inline `options` arrays are empty in unfiltered browse mode — pass a filter or `templateIdentifier` to get the option schema.

### XcodeNewTarget

Adds a new target to a project in the current Xcode workspace using a target template.

- **Params** (+ `workspaceIdentifier`): `productName`* — The new target's product name (PRODUCT_NAME), e.g. 'MyFeature'; `templateIdentifier`* — Template identifier to instantiate (e.g. 'com.apple.dt.unit.iosFramework'); `embedInAppNamed` — Optional name of an existing application target to embed the new target into…; `options` — Optional dictionary of template-specific options; `organizationIdentifier` — Optional bundle-identifier prefix to set on the new target…; `projectPath` — Optional project-organization or filesystem path to the .xcodeproj that should own the new…

- **Returns**: `additionalTargetsCreated`*, `targetName`*, `activeSchemeName`, `containingProjectPath`, `primaryFilePath`, `targetGroupPath`

### XcodeListTargets

Lists targets in the current Xcode workspace, optionally scoped to a single project.

- **Params** (+ `workspaceIdentifier`): `productTypeFilter` — Optional list of product-type identifiers; `projectPath` — Optional project-organization or filesystem path to a specific .xcodeproj container in the…

- **Returns**: `fullTargetListPath`*, `targets`*, `totalTargets`*, `truncated`*, `message`

---

## File Operations

### XcodeRead

Reads the contents of a file within the Xcode project organization.

- **Params** (+ `workspaceIdentifier`): `filePath`* — The path to the file within the Xcode project organization…; `limit` — The number of lines to read (only provide if the file is too large to read at once); `offset` — The line number to start reading from (only provide if the file is too large to read at once)

- **Returns**: `content`*, `filePath`*, `fileSize`*, `linesRead`*, `startLine`*, `totalLines`*, `message`

### XcodeWrite

Creates or overwrites files with content in the Xcode project.

- **Params** (+ `workspaceIdentifier`): `content`* — The content to write to the file; `filePath`* — The path to the file within the Xcode project organization…

- **Returns**: `bytesWritten`*, `filePath`*, `linesWritten`*, `message`*, `success`*, `wasExistingFile`*, `absolutePath`

- **Notes**: Overwrites an existing file wholesale — there is no create-only mode. Use `XcodeUpdate` to edit.

### XcodeUpdate

Edits files in the Xcode project by replacing text content.

- **Params** (+ `workspaceIdentifier`): `filePath`* — The path to the file to modify within the Xcode project organization…; `newString`* — The text to replace it with, must be different from oldString; `oldString`* — The text to replace; `replaceAll` — Replace all occurrences of oldString (default false)

- **Returns**: `editsApplied`*, `filePath`*, `modifiedContentLength`*, `originalContentLength`*, `success`*, `message`

- **Notes**: `oldString`/`newString` use literal characters: if `XcodeRead` shows `\d`, pass `\d`. One replacement unless `replaceAll` is true.

### XcodeGlob

Finds files in the Xcode project structure matching wildcard patterns.

- **Params** (+ `workspaceIdentifier`): `path` — Which project directory to search in (optional, defaults to root); `pattern` — File matching pattern using wildcards (* ** ? [abc] {swift,m})

- **Returns**: `matches`*, `pattern`*, `searchPath`*, `totalFound`*, `truncated`*, `message`, `packageDependencies`

### XcodeGrep

Searches for text patterns in files within the Xcode project structure using regex.

- **Params** (+ `workspaceIdentifier`): `pattern`* — Text to search for using regex; `glob` — Only search files matching this pattern; `headLimit` — Stop after N results; `ignoreCase` — Ignore case when matching; `linesAfter` — Show N lines after each match for context; `linesBefore` — Show N lines before each match for context; `linesContext` — Show N lines both before and after each match; `multiline` — Allow patterns to span multiple lines; `outputMode` — What to return: content, files_with_matches, or count (default: files_with_matches); `path` — Where to search - file or directory in project (defaults to root); `showLineNumbers` — Show line numbers with results (content mode only); `type` — Shortcut for common file types (swift, js, py, etc.)

- **Returns**: `matchCount`*, `pattern`*, `results`*, `searchPath`*, `truncated`*, `message`, `packageDependencies`

### XcodeLS

Lists files and directories in the Xcode project structure at the specified path.

- **Params** (+ `workspaceIdentifier`): `path`* — The project path to browse (e.g., 'ProjectName/Sources/'); `ignore` — Skip files/folders matching these patterns; `recursive` — Recursively list all files (truncated to 100 lines)

- **Returns**: `items`*, `path`*, `message`, `packageDependencies`

### XcodeMakeDir

Creates directories in the Xcode project structure. Creates a file system synchronized (buildable) folder by default, or a classic group when requested.

- **Params** (+ `workspaceIdentifier`): `directoryPath`* — Project navigator relative path for the directory to create; `directoryKind` — `folder` (default) or `group` (27.2)

- **Returns**: `message`*, `success`*, `createdPath`

- **Notes**: `folder` creates a file-system-synchronized (buildable) folder; `group` creates a classic group backed by a directory on disk. The schema types `directoryKind` as a plain string, not an enum, and the server "falls back to whatever the parent supports", so the requested kind is not guaranteed. Builds before the 27.2 RC (27B48) take only `directoryPath`.

### XcodeMV

Moves or renames files and directories in the project navigator with support for filesystem operations.

- **Params** (+ `workspaceIdentifier`): `destinationPath`* — Project navigator relative path for the destination (for move) or new name (for rename); `sourcePath`* — Project navigator relative path of the source item to move/rename; `operation` — The type of move operation to perform; `overwriteExisting` — Whether to overwrite existing files at the destination

- **Returns**: `message`*, `operation`*, `success`*, `destinationFinalPath`, `sourceOriginalPath`

### XcodeRM

Removes files and directories from the Xcode project structure and optionally deletes the underlying files from the filesystem.

- **Params** (+ `workspaceIdentifier`): `path`* — The project path to remove (e.g., 'ProjectName/Sources/MyFile.swift'); `deleteFiles` — Also move the underlying files to Trash (defaults to true); `recursive` — Remove directories and their contents recursively

- **Returns**: `message`*, `removedPath`*, `success`*

- **Notes**: `deleteFiles` defaults to **true** (moves to Trash). Confirm with the user before calling.

---

## Build

### BuildProject

Builds an Xcode project and waits until the build completes.

- **Params** (+ `workspaceIdentifier`): `buildForTesting` — Whether to also build test targets that would not usually be included in a regular build

- **Returns**: `buildResult`*, `errors`*, `fullLogPath`*, `elapsedTime`

### GetBuildLog

Gets the log of the current or most recently finished build.

- **Params** (+ `workspaceIdentifier`): `glob` — Glob to filter the returned build log entries; `pattern` — Regex to filter the returned build log entries; `severity` — Limit the output of build log entries to those that emitted issues of the specified severity…

- **Returns**: `buildIsRunning`*, `buildLogEntries`*, `buildResult`*, `fullLogPath`*, `totalFound`*, `truncated`*, `message`

- **Notes**: Filter server-side with `severity`, `pattern` (regex on message), and `glob` (on issue path) rather than post-processing the raw log.

### XcodeRefreshCodeIssuesInFile

Retrieves current compiler diagnostics (errors, warnings, notes) for a file in the Xcode project.

- **Params** (+ `workspaceIdentifier`): `filePath`* — The path to the file within the Xcode project organization…

- **Returns**: `content`*, `diagnosticsCount`*, `filePath`*, `success`*

- **Notes**: Per-file only — `filePath` is required. For project-wide diagnostics use `GetBuildLog`.

### GetTargetBuildSettings

Get all the Xcode build setting for a specified Xcode project target.

- **Params** (+ `workspaceIdentifier`): `targetName`* — The name of a given Xcode project target; `projectPath` — The project-organization path of the .xcodeproj that owns the target…

- **Returns**: `buildSettings`*, `targetName`*

### UpdateTargetBuildSetting

Updates, appends or deletes the named build setting for the specified Xcode project target.

- **Params** (+ `workspaceIdentifier`): `buildSettingName`* — The build setting name to update or add; `targetName`* — The name of a given Xcode project target; `appendValue` — Append the value instead of replacing the current value; `buildSettingValue` — The value to be added to build settings; `projectPath` — The project-organization path of the .xcodeproj that owns the target…

### GetFileCompilerFlags

Gets the additional per-file compiler flags for a single source file in a specific Xcode target — the same value shown in the Compiler Flags column of Target > Build Phases > Compile Sources.

- **Params** (+ `workspaceIdentifier`): `filePath`* — The path to the source file within the Xcode project organization…; `targetName`* — The name of the Xcode target whose build phase contains the source file; `projectPath` — The project-organization path of the .xcodeproj that owns the target…

- **Returns**: `compilerFlags`*, `filePath`*, `targetName`*, `guidance`, `warning`

### UpdateFileCompilerFlags

Updates, appends or deletes the additional per-file compiler flags for a single source file in a specific Xcode target — the same value shown in the Compiler Flags column of Target > Build Phases > Co…

- **Params** (+ `workspaceIdentifier`): `filePath`* — The path to the source file within the Xcode project organization…; `targetName`* — The name of the Xcode target whose build phase contains the source file; `appendValue` — Append the value to any existing compiler flags (separated by a single space) instead of…; `compilerFlags` — The additional compiler flags to set on the file, as a single space-separated string…; `projectPath` — The project-organization path of the .xcodeproj that owns the target…

- **Returns**: `compilerFlags`*, `filePath`*, `previousFlags`*, `targetName`*, `guidance`, `warning`

---

## Run & Debug

### RunProject

Builds and runs the current scheme in Xcode, equivalent to pressing the Run button (Cmd+R).

- **Params** (+ `workspaceIdentifier`): `attachDebugger` — Whether to attach the debugger to the launched process

- **Returns**: `buildErrors`*, `fullLogPath`*, `runResult`*, `elapsedTime`, `launchSessionReference`, `processIdentifier`

### StopProject

Stops the currently running app in Xcode, equivalent to pressing the Stop button (Cmd+.).

- **Params** (+ `workspaceIdentifier`): none

- **Returns**: `stopResult`*, `processIdentifier`

### GetConsoleOutput

Retrieves console output (stdout, stderr, OSLog) from a running or completed app launch session.

- **Params** (+ `workspaceIdentifier`): `contextLines` — Number of context lines to include around pattern matches (like grep -C); `includeMetadata` — Include detailed OSLog metadata (subsystem, category, pid, tid, sender info); `launchSessionReference` — Optional launch session reference; `oslogSeverity` — Filter OSLog by severity levels; `outputType` — Type of output to retrieve: 'stdio' (stdout/stderr only), 'oslog' (OSLog only), or 'all'…; `pattern` — Optional regex pattern to filter console output; `tailLimit` — Maximum number of lines to return from the END of output (tail behavior)

- **Returns**: `launchSessionInfo`*, `totalCount`*, `truncated`*, `units`*

### InvokeDebuggerCommand

Sends an lldb command to Xcode's active debugging session and returns the output.

- **Params** (+ `workspaceIdentifier`): `command`* — The lldb command to execute in Xcode's active debug session…; `timeout` — Maximum seconds to wait for the command to complete

- **Returns**: `debugSessionActive`*, `isWaitingForMore`*, `output`*, `processIdentifier`

- **Notes**: `timeout` defaults to 30s; raise it for commands that resume execution (`continue`). `isWaitingForMore: true` means the command timed out and may still be running — check with a simple command such as `thread list`. From 27.2 beta 2 the description recommends `p` or `v` for variable inspection,
  reserving `po` or `expression` for operations that need them (function calls, casts,
  arithmetic). The process must already be running with the debugger attached;
  `RunProject(attachDebugger: true)` can establish that session. Check `process status`
  before commands that require a stopped process unless its state is already known.

### RunCodeSnippet

Builds and runs a snippet of code in the context of a specific file and waits until results are available.

- **Params** (+ `workspaceIdentifier`): `codeSnippet`* — The code snippet that should be run within the context of the specified Swift file; `purpose`* — A short human-readable description of the purpose of running this code snippet; `sourceFilePath`* — The path to a Swift source file within the Xcode project organization…; `timeout` — The time in seconds to wait for the running of the snippet to complete

- **Returns**: `error`, `executionResults`

- **Notes**: `purpose` is required and Apple's schema forbids the word "test" in it. Swift only — no `language` parameter. Runs with the file's `fileprivate` scope. `timeout` defaults to 600s. Named `ExecuteSnippet` in earlier 27 betas; that name no longer resolves.

---

## Testing

### GetTestList

Gets all available tests from the active scheme's active test plan.

- **Params** (+ `workspaceIdentifier`): none

- **Returns**: `counts`*, `fullTestListPath`*, `schemeName`*, `summary`*, `tests`*, `totalTests`*, `truncated`*, `activeTestPlanName`

- **Notes**: Caps inline output at 100 tests and writes the full list to `fullTestListPath` in grep-friendly form — grep it for `TEST_TARGET`, `TEST_IDENTIFIER`, or `TEST_FILE_PATH`.

### RunAllTests

Runs all tests from the active scheme's active test plan

- **Params** (+ `workspaceIdentifier`): none

- **Returns**: `counts`*, `fullSummaryPath`*, `results`*, `schemeName`*, `summary`*, `totalResults`*, `truncated`*, `activeTestPlanName`, `fullConsoleLogsPath`, `message`, `xcresultBundlePath`

### RunSomeTests

Runs specific tests using the active scheme's active test plan

- **Params** (+ `workspaceIdentifier`): `tests`* — Array of test specifiers to run

- **Returns**: `counts`*, `fullSummaryPath`*, `results`*, `schemeName`*, `summary`*, `totalResults`*, `truncated`*, `activeTestPlanName`, `fullConsoleLogsPath`, `message`, `xcresultBundlePath`

- **Notes**: `tests` is an array of specifiers, each with `targetName` and `testIdentifier` — not bare test names. Source them from `GetTestList`.

### XcodeListTestPlans

Lists the test plans associated with the currently active scheme and identifies which one is active.

- **Params** (+ `workspaceIdentifier`): none

- **Returns**: `fullTestPlanListPath`*, `message`*, `schemeName`*, `testPlans`*, `totalTestPlans`*, `truncated`*, `usesTestPlans`*, `activeTestPlanName`

### XcodeSwitchTestPlan

Changes the active test plan for the currently active scheme.

- **Params** (+ `workspaceIdentifier`): `testPlanName`* — Which test plan to make active

- **Returns**: `activeTestPlanName`*, `message`*, `schemeName`*, `activeTestPlanPath`

---

## Schemes & Run Destinations

### XcodeListSchemes

Lists all schemes available in the current Xcode workspace and identifies which one is currently active.

- **Params** (+ `workspaceIdentifier`): none

- **Returns**: `fullSchemeListPath`*, `schemes`*, `totalSchemes`*, `truncated`*, `activeSchemeName`, `message`

### XcodeSwitchScheme

Changes the active scheme in the current Xcode workspace to the specified scheme.

- **Params** (+ `workspaceIdentifier`): `schemeName`* — The name of the scheme to make active

- **Returns**: `activeSchemeName`*, `message`*, `activeDestinationDisplayTitle`, `activeTestPlanName`

### XcodeListRunDestinations

Lists run destinations available for the currently active scheme, grouped the same way the Xcode picker groups them (Devices, Simulators, Build, Incompatible, etc.), and identifies which one is active…

- **Params** (+ `workspaceIdentifier`): `includeIncompatible` — When true, destinations in the 'Incompatible' group are included in the inline `destinations`…

- **Returns**: `destinations`*, `fullRunDestinationListPath`*, `groups`*, `totalDestinations`*, `truncated`*, `activeDestinationDisplayTitle`, `activeSchemeName`, `message`

### XcodeSwitchRunDestination

Changes the active run destination for the currently active scheme.

- **Params** (+ `workspaceIdentifier`): `displayTitle`* — The destination's `displayTitle` — the disambiguated label shown in the Xcode picker

- **Returns**: `activeDestinationDisplayTitle`*, `activeSchemeName`*, `message`*

---

## Previews

### RenderPreview

Builds and renders a Preview and waits until a snapshot of the resulting UI is available.

- **Params** (+ `workspaceIdentifier`): `sourceFilePath`* — The path to the file within the Xcode project organization…; `displayMode` — `static` (default) or `interactive`, from `supportedOverrides.displayModes`; `preferredRenderDestination` — object of optional `identifier`, `platformName`, `deviceModelName`, `systemVersion`; `previewCanvasControlOverrides` — `groupItemIndex`, `timelineIndex`, `toggleState`; `previewDefinitionIndexInFile` — The zero based index of the #Preview macro or PreviewProvider struct definition in the source…; `previewLocalizationOverride` — A locale identifier to preview in (e.g. "fr", "ja"); `previewVariantOverrides` — A dictionary mapping variant group names to variant names for any preview variants that should…; `snapshotDelay` — integer seconds an interactive preview runs before capture; `timeout` — The time in seconds to wait for the rendering of the preview to complete

- **Returns**: `errors`*, `displayName`, `renderedDestination`, `snapshot` (`path`*), `sourceLineNumber`, `supportedOverrides` (`canvasControls`, `displayModes`, `localizations`, `previewVariants`, `renderDestinations`)

- **Notes**: `timeout` defaults to 120s. Take every override value from the `supportedOverrides` of a previous call for the same active scheme (and, except for `preferredRenderDestination`, the same run destination) rather than guessing. Apple's input descriptions name output fields that don't exist — `groupItemIndexes` and `toggleState`; the real fields are `canvasControls.groupItems` and `canvasControls.toggleStates`. Don't call in parallel while passing `previewLocalizationOverride`. `snapshotDelay` applies only to `interactive`, counts against `timeout`, and must be at least 0 and less than `timeout`, or the call fails. `displayName` matches the canvas tab title; `sourceLineNumber` (1-based) separates previews that share a name.

#### Destination selection

`preferredRenderDestination` takes values from a prior call's
`supportedOverrides.renderDestinations` for the same active scheme. Every supplied field must
match; omitted fields impose no constraint, and the first matching destination is selected.
Omitting the object lets the server choose automatically. Each `renderDestinations` entry
requires `identifier`; the array is omitted when the server cannot determine destinations.
An unmatched preference falls back to automatic selection and adds a message to `errors`, so
compare `renderedDestination.identifier` (required whenever `renderedDestination` is present)
with your selection rather than assuming the preference was honored.

`supportedOverrides.canvasControls.groupItems` entries are objects with required integer
`index` and optional `title` (titles can repeat); pass `index` as
`previewCanvasControlOverrides.groupItemIndex`. The array is omitted when the preview has no
group-item control.

#### Field names by build

A client that reads the earlier field names finds no snapshot path and no override lists in
the output of 27.2 (RC and release). Read field paths from the live `outputSchema`.

| Field | 27.2 (27B52; RC 27B48) | 27.2 beta 2 (27B5028f) | 27.1 RC (27A9275) and earlier |
|---|---|---|---|
| Snapshot path | `snapshot.path` | `previewSnapshotPath` | `previewSnapshotPath` |
| Canvas controls | `supportedOverrides.canvasControls` | `supportedCanvasControlOverrides` | `supportedCanvasControlOverrides` |
| Localizations | `supportedOverrides.localizations` | `supportedLocalizations` | `supportedLocalizations` |
| Preview variants | `supportedOverrides.previewVariants` | `supportedPreviewVariantOverrides` | `supportedPreviewVariantOverrides` |
| Render destinations | `supportedOverrides.renderDestinations` | `availableRenderDestinations` | absent |
| Display modes | `supportedOverrides.displayModes` | absent | absent |
| Inputs `displayMode`, `snapshotDelay` | present | absent | absent |
| Input `preferredRenderDestination` | present | present | absent |
| `groupItems` entries | `{index*, title}` objects | `{index*, title}` objects | integers |
| `errors` | required | required | optional (no output field required) |
| `renderedDestination.identifier` | required when object present | required when object present | absent (object still has platform, model, version) |

---

## Device Interaction

### DeviceInteractionStartSession

Prepares a runtime for iOS interaction WITHOUT a workspace.

- **Params**: `deviceIdentifier`* — The UUID/ECID/name/OS version/type of the device to perform interaction; `sessionIdentifier`* — Unique human-friendly identifier for this session (e.g. "Verify Login Flow")

- **Returns**: `deviceIsSimulator`*, `deviceUUID`*, `interactionSessionKey`*, `skillToTrigger`*, `summary`*

- **Notes**: Cannot build or install — use `DeviceInteractionStartWorkspaceSession` if you need `DeviceInteractionInstallAndRun`. Sessions are expensive; always close with `DeviceInteractionEndSession`.

### DeviceInteractionStartWorkspaceSession

Prepares a runtime for iOS interaction WITH a workspace.

- **Params** (+ `workspaceIdentifier`): `sessionIdentifier`* — Unique human-friendly identifier for this session (e.g. "Verify Login Flow"); `deviceIdentifier` — The UUID/ECID/name/OS version/type of the device to perform interaction

- **Returns**: `deviceIsSimulator`*, `deviceUUID`*, `interactionSessionKey`*, `skillToTrigger`*, `summary`*

### DeviceInteractionInstallAndRun

Builds, installs, and starts the current application on the currently targeted device.

- **Params** (+ `workspaceIdentifier`): `interactionSessionKey`* — Device Interaction session identifier that initiates this call; `commandLineArguments` — Arguments that the application should be run with; `environmentVariables` — Environment variables that the application should be run with

- **Returns**: `userMessage`*

### DeviceInteractionSynthesize

Synthesizes device events (tap, swipe, type, etc.) on a physical device or simulator and captures the resulting state.

- **Params**: `interactSessionKey`* — Device Interaction session key to work with; `activationBundleId` — Bundle identifier of the app to activate before any interactions; `interactionCommand` — The interaction command to execute (e.g., 't 100 200' for tap)

- **Returns**: `applicationState`*, `hierarchyPath`*, `logsPath`*, `screenshotPath`*, `thumbnailScreenshotPath`*

- **Notes**: Always derive coordinates from the most recent hierarchy dump (`hierarchyPath`), never from a screenshot alone.

### DeviceInteractionEndSession

Closes previous device session created in DeviceInteractionStartSession or DeviceInteractionStartWorkspaceSession.

- **Params**: `interactionSessionKey`* — Device Interaction session to close

- **Returns**: `userMessage`*

---

## Crash & Field Diagnostics

### GetTopCrashIssues

Retrieve the top crash signatures for an app from Apple's crash reporting service.

- **Params** (+ `workspaceIdentifier`): `app_version` — The app version to filter by (e.g., 4.6); `bundle_id` — The bundle identifier of the app (e.g., com.apple.Playgrounds); `count` — Number of top crash signatures to return; `is_beta` — Whether to fetch TestFlight (true) or App Store (false) data; `platform` — The platform to query (e.g., 'iOS', 'macOS', 'watchOS', 'tvOS', 'visionOS')

- **Returns**: `bundleId`*, `data`*, `message`*, `success`*, `appVersion`

### GetCrashIssueLogs

Get detailed crash logs, expert triage knowledge, and actionable recommendations for a specific crash signature.

- **Params** (+ `workspaceIdentifier`): `signature_name`* — The human-readable crash signature name from GetTopCrashIssues; `app_version` — The app version to filter crash logs by (e.g., 4.6); `bundle_id` — The bundle identifier of the app (e.g., com.apple.Playgrounds); `is_beta` — Whether to fetch TestFlight (true) or App Store (false) data; `platform` — The platform to query (e.g., 'iOS', 'macOS', 'watchOS', 'tvOS', 'visionOS')

- **Returns**: `bundleId`*, `data`*, `message`*, `signatureName`*, `success`*, `appVersion`

### GetTopFieldPerformanceIssues

Analyze app performance and identify performance regressions across different diagnostic types.

- **Params** (+ `workspaceIdentifier`): `diagnostic_type`* — The type of performance diagnostic to retrieve; `app_version` — The app version (e.g., 4.6); `bundle_id` — The bundle identifier of the app (e.g., com.apple.Playgrounds); `is_beta` — Whether to fetch TestFlight (true) or App Store (false) data; `platform` — The platform to query (e.g., 'iOS', 'macOS', 'watchOS', 'tvOS', 'visionOS')

- **Returns**: `bundleId`*, `data`*, `diagnosticType`*, `message`*, `success`*, `appVersion`, `availableVersions`

### GetFieldPerformanceIssueLogs

Get detailed logs, performance data, expert triage knowledge, and actionable recommendations for specific field performance issue.

- **Params** (+ `workspaceIdentifier`): `app_version`* — The app version (e.g., 13.14.0); `diagnostic_type`* — The type of performance diagnostic to retrieve; `signature_name`* — The human-readable signature name from GetTopFieldPerformanceIssues; `bundle_id` — The bundle identifier of the app (e.g., com.toyopagroup.picaboo); `is_beta` — Whether to fetch TestFlight (true) or App Store (false) data; `platform` — The platform to query (e.g., 'iOS', 'macOS', 'watchOS', 'tvOS', 'visionOS')

- **Returns**: `appVersion`*, `bundleId`*, `data`*, `diagnosticType`*, `message`*, `signatureName`*, `success`*

---

## Localization & String Catalogs

### LocalizationPlanner

Ensures the project is in a state where translations can be added.

- **Params** (+ `workspaceIdentifier`): `targetLocaleIdentifier`* — The locale identifier for which you want to translate

- **Returns**: `nextStep`*, `changesMade`, `stepsFailed`, `suggestions`

### StringCatalogContext

Returns context and the source language value for a given string in the String Catalog.

- **Params** (+ `workspaceIdentifier`): `filePath`* — The path to the String Catalog; `stringKey`* — String key for which to get context for; `targetLocaleIdentifier`* — The locale identifier for which you want to translate

- **Returns**: `nextSteps`*, `shouldTranslate`*, `similarStrings`*, `sourceValues`*, `translations`*, `usageLocations`*, `appearances`, `comment`, `isStringSet`, `relevantPluralCases`, `sourcePluralCasesToAdd`, `supportedDevices`, `usageDataUnavailable`

### StringCatalogRead

Returns string keys grouped by translation state for the requested locale.

- **Params** (+ `workspaceIdentifier`): `filePath`* — The path to the String Catalog; `targetLocaleIdentifier`* — Locale identifier to check translations for; `keyLimit` — Maximum number of keys to return; `offset` — Number of keys to skip before returning results; `requestedState` — The translation state to retrieve keys for

- **Returns**: `machineTranslatedCount`*, `needsReviewCount`*, `newCount`*, `nextStep`*, `translatedCount`*, `keys`, `requestedState`, `returnedCount`, `totalForRequestedState`

### StringCatalogEdit

Inserts a translation for a given locale into a String Catalog.

- **Params** (+ `workspaceIdentifier`): `filePath`* — The path to the String Catalog; `stringKey`* — String key to translate; `targetLocaleIdentifier`* — Identifier of the locale for which to insert the given translation; `stringSetTranslation` — Array of translated values for string sets; `templateTranslation` — Translation with template + substitutions for varying a string by plural or for translating a…; `translation` — Simple string translation for non-varied strings; `variationTranslation` — Variation structure for strings with top-level plural, device, or width variations

- **Returns**: `message`*, `success`*

---

## Project Configuration

### AddEntitlement

Add a new entitlement to the project's entitlements file.

- **Params** (+ `workspaceIdentifier`): `entitlementKey`* — The entitlement key you want to add; `entitlementValueType`* — The type of the entitlement value; `targetName`* — The name of the Xcode target to add the entitlement to; `entitlementDictionaryItems` — A JSON-encoded string representing a dictionary; `entitlementValue` — The entitlement value as a string; `entitlementValueItems` — Array of string values; `projectPath` — The project-organization path of the .xcodeproj that owns the target…

- **Returns**: `result`*, `errorDescription`

### AddInfoPlist

Add or update an Info.plist key in the project.

- **Params** (+ `workspaceIdentifier`): `infoPlistKey`* — The Info.plist key to add or change; `infoPlistValueType`* — `bool`, `string`, `int`, `stringArray`, `dictionary`, or `dictionaryArray`; `targetName`* — The name of the Xcode target whose Info.plist key should be added or updated; `infoPlistDictionaryItems` — A JSON-encoded string: one dictionary for `dictionary`, an array of dictionaries for `dictionaryArray`; `infoPlistValue` — The value as a string (`bool`, `string`, `int`); `infoPlistValueItems` — Array of string values (`stringArray`); `projectPath` — The project-organization path of the .xcodeproj that owns the target…

- **Returns**: `result`*, `errorDescription`

- **Notes**: Use `dictionary` for a single dictionary value such as App Transport Security settings (`'{"NSAllowsArbitraryLoads": true}'`) and `dictionaryArray` only for an array of dictionaries. `dictionary` is new in 27.2 (from the RC); earlier enums lack it, and their descriptions pointed App Transport Security at `dictionaryArray`. Check the live enum first; where `dictionary` is absent, don't wrap a dictionary-valued key such as `NSAppTransportSecurity` in `dictionaryArray` — the tool has no single-dictionary type on that build. Not for entitlements — use `AddEntitlement`.

---

## Documentation

### DocumentationSearch

Searches Apple Developer Documentation using semantic matching.

- **Params**: `query`* — The search query; `frameworks` — Framework(s) to search in

- **Returns**: `documents`*

- **Notes**: Listed on the released 27.2 (27B52) and its RC (27B48) to an unapproved agent with no workspace open, as on beta 6 and the released 27.0, and present in the 27.1 RC capture. Absent on 27.2 beta 2 (27B5028f), including the approved-with-workspace capture. The tool set is dynamic: re-list and check the server/build when it is missing; its absence alone does not establish a workspace or approval requirement. Use `axiom-apple-docs` for bundled guides and SDK-first Apple documentation research when this tool is unavailable.

## Resources

**Docs**: /xcode/mcp-server, /xcode/giving-external-agents-access-to-xcode

**Skills**: axiom-xcode-mcp (skills/xcode-mcp-setup.md), axiom-xcode-mcp (skills/xcode-mcp-tools.md), axiom-xcode-mcp (skills/axe-ref.md), axiom-tools (skills/device-control-ref.md)
