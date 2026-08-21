
# Xcode MCP Tool Reference

Complete reference for every tool exposed by Xcode's MCP server. `xcrun mcpbridge` is the stdio
transport; on Xcode 27 the service behind it can run headless (`xcrun mcp-server`) — see
`axiom-xcode-mcp (skills/xcode-mcp-setup.md)`.

**Source**: live `tools/list` on Xcode 27 beta 5 (27A5237l), `serverInfo` version 25280.8,
protocol 2025-06-18.

**Tool count is 53 without a workspace open, 54 with.** The server advertises
`capabilities.tools.listChanged: true`, and `DocumentationSearch` is the sole workspace-gated
tool. A tool missing from `tools/list` may just mean no workspace is open.

**`workspaceIdentifier` is required in practice wherever tested** — even when only one workspace
is open, and even though it appears in no tool's `required` list. 46 of the 54 tools accept it;
omitting it on `XcodeListSchemes` and `XcodeListTargets` returned an error naming the valid
identifiers, so assume the same for the rest rather than treating the empty `required` list as
permission to skip it:

```
Error: workspaceIdentifier is required for this action. Choose from the following open
workspaces, or open one with XcodeOpenWorkspace:
* workspaceIdentifier: workspace-Gxw7GRzGoI, workspacePath: /path/to/MyApp.xcodeproj
```

Get identifiers from `XcodeListWorkspaces`. They are readable slugs (`workspace-Gxw7GRzGoI`), not
UUIDs. `tabIdentifier` — the Xcode 26.x targeting parameter — appears in **zero** tools on 27.

**Reading the entries below**: `*` marks required fields. `(+ workspaceIdentifier)` on the Params
line means the tool accepts it; it is omitted from each list to avoid repeating it 46 times.
`Returns` fields come from each tool's `outputSchema`. All 54 declare one and responses carry
`structuredContent`, but a few declare an **empty** schema (`UpdateTargetBuildSetting`) — those
entries have no `Returns` line, which means "no structured fields", not "undocumented".

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

- **Params** (+ `workspaceIdentifier`): none

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

Creates directories and groups in the Xcode project structure.

- **Params** (+ `workspaceIdentifier`): `directoryPath`* — Project navigator relative path for the directory to create

- **Returns**: `message`*, `success`*, `createdPath`

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

- **Params** (+ `workspaceIdentifier`): `sourceFilePath`* — The path to the file within the Xcode project organization…; `previewCanvasControlOverrides` — Optional overrides for the canvas controls, only applicable to preview types that support each…; `previewDefinitionIndexInFile` — The zero based index of the #Preview macro or PreviewProvider struct definition in the source…; `previewLocalizationOverride` — A locale identifier to preview in (e.g. "fr", "ja"); `previewVariantOverrides` — A dictionary mapping variant group names to variant names for any preview variants that should…; `timeout` — The time in seconds to wait for the rendering of the preview to complete

- **Returns**: `displayName`, `errors`, `previewSnapshotPath`, `renderedDestination`, `sourceLineNumber`, `supportedCanvasControlOverrides`, `supportedLocalizations`, `supportedPreviewVariantOverrides`

- **Notes**: `timeout` defaults to 120s. Use `supportedLocalizations` and variant keys returned by a previous call rather than guessing override values.

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

- **Params** (+ `workspaceIdentifier`): `infoPlistKey`* — The Info.plist key to add or change; `infoPlistValueType`* — The type of the Info.plist value; `targetName`* — The name of the Xcode target whose Info.plist key should be added or updated; `infoPlistDictionaryItems` — A JSON-encoded string representing an array of dictionaries; `infoPlistValue` — The value as a string; `infoPlistValueItems` — Array of string values; `projectPath` — The project-organization path of the .xcodeproj that owns the target…

- **Returns**: `result`*, `errorDescription`

---

## Documentation

### DocumentationSearch

Searches Apple Developer Documentation using semantic matching.

- **Params**: `query`* — The search query; `frameworks` — Framework(s) to search in

- **Returns**: `documents`*

- **Notes**: **Workspace-gated** — the only tool that appears solely when a workspace is open (53 tools without, 54 with). Its absence means "open a workspace", not "removed".

## Resources

**Docs**: /xcode/mcp-server, /xcode/giving-external-agents-access-to-xcode

**Skills**: axiom-xcode-mcp (skills/xcode-mcp-setup.md), axiom-xcode-mcp (skills/xcode-mcp-tools.md), axiom-xcode-mcp (skills/axe-ref.md), axiom-tools (skills/device-control-ref.md)
