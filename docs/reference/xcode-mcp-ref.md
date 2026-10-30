---
name: xcode-mcp-ref
description: Tool parameters, return shapes, and build-specific behavior for Xcode's MCP server, verified against Xcode 27.2
---

# Xcode MCP Tool Reference

Reference for Xcode's Model Context Protocol server, which lets an AI assistant drive Xcode directly. Covers the 54 tools of Xcode 27.2 (27B52, server version 25464, the same schemas as the 27.2 RC), plus the fields that differ on the 53-tool 27.2 beta 2 (27B5028f) and on Xcode 27.0 and the 27.1 RC (27A9275).

## When to Use This Reference

Use this reference when:
- Looking up the exact parameter list for a specific MCP tool
- Checking the return-shape contract for `BuildProject`, `RunAllTests`, `RenderPreview`, or any other tool
- Verifying which parameters are required versus optional
- Working out why a call failed with `workspaceIdentifier is required for this action`
- Choosing between near-equivalent tools (`XcodeUpdate` vs `XcodeWrite`, `RunAllTests` vs `RunSomeTests`, `GetBuildLog` vs `XcodeRefreshCodeIssuesInFile`)
- Bootstrapping a headless session — opening, creating, or listing workspaces
- Wondering why a tool you expected is missing from `tools/list`

## Example Prompts

- "What parameters does BuildProject take?"
- "What does GetBuildLog return?"
- "How do I open a project when Xcode isn't running?"
- "What's the difference between RunSomeTests and RunAllTests?"
- "Why does my tool call say workspaceIdentifier is required when only one project is open?"
- "Why can't I find DocumentationSearch in the tool list?"
- "What does XcodeNewProject need — projectName or productName?"
- "How do I choose a RenderPreview destination or render an interactive preview?"
- "Where did previewSnapshotPath go in RenderPreview's output?"
- "How do I add App Transport Security settings with AddInfoPlist?"
- "Does XcodeMakeDir create a group or a folder?"
- "Why is GetCodeCoverage in the 27.2 prerelease notes but missing from my tool list?"
- "Which LLDB commands does InvokeDebuggerCommand recommend for inspecting variables?"

## What's Covered

### Workspaces & projects
`XcodeListWorkspaces`, `XcodeOpenWorkspace`, `XcodeCloseWorkspace`, `XcodeNewProject`, `XcodeListTemplates`, `XcodeNewTarget`, `XcodeListTargets`

### File operations
`XcodeRead`, `XcodeWrite`, `XcodeUpdate`, `XcodeGlob`, `XcodeGrep`, `XcodeLS`, `XcodeMakeDir`, `XcodeMV`, `XcodeRM`

### Build
`BuildProject`, `GetBuildLog`, `XcodeRefreshCodeIssuesInFile`, `GetTargetBuildSettings`, `UpdateTargetBuildSetting`, `GetFileCompilerFlags`, `UpdateFileCompilerFlags`

### Run & debug
`RunProject`, `StopProject`, `GetConsoleOutput`, `InvokeDebuggerCommand`, `RunCodeSnippet`

### Testing
`GetTestList`, `RunAllTests`, `RunSomeTests`, `XcodeListTestPlans`, `XcodeSwitchTestPlan`

### Schemes & run destinations
`XcodeListSchemes`, `XcodeSwitchScheme`, `XcodeListRunDestinations`, `XcodeSwitchRunDestination`

### Previews
`RenderPreview`, `displayMode`, `snapshotDelay`, `preferredRenderDestination`, `snapshot.path`, `supportedOverrides`, `renderedDestination.identifier`, `groupItems`, field names by build

### Device interaction
`DeviceInteractionStartSession`, `DeviceInteractionStartWorkspaceSession`, `DeviceInteractionInstallAndRun`, `DeviceInteractionSynthesize`, `DeviceInteractionEndSession`

### Crash & field diagnostics
`GetTopCrashIssues`, `GetCrashIssueLogs`, `GetTopFieldPerformanceIssues`, `GetFieldPerformanceIssueLogs`

### Localization & string catalogs
`LocalizationPlanner`, `StringCatalogContext`, `StringCatalogRead`, `StringCatalogEdit`

### Project configuration
`AddEntitlement`, `AddInfoPlist` (including the `dictionary` value type on Xcode 27.2)

### Documentation
`DocumentationSearch` (absent in Xcode 27.2 beta 2)

Each tool entry adds notes on caveats that Apple's schema descriptions bury, among them the word "test" being forbidden in `RunCodeSnippet`'s `purpose`, `XcodeRM` moving files to the Trash by default, `XcodeListTemplates` truncating to 100 of 193 templates, and `GetTestList` capping inline output at 100 tests. The full reference also covers `XcodeMakeDir`'s choice between a synchronized folder and a classic group, preview-destination selection, the debugger-command recommendations added in 27.2 beta 2, and the `GetCodeCoverage` tool that 27.2's prerelease notes announced but the release doesn't include.

## Two Things That Trip Everyone Up

**Tool availability and field names depend on the build.** Xcode 27.2 and 27.0 list all 54 tools with no workspace open, including `DocumentationSearch`, and the 27.1 RC lists the same 54. Xcode 27.2 beta 2 lists 53, without `DocumentationSearch`, even with the agent approved and a workspace open. `GetCodeCoverage`, announced in the 27.2 beta 2 and RC release notes, isn't in the released 27.2, and its release notes no longer mention it. From the 27.2 RC, `RenderPreview` returns its snapshot path and supported overrides under new names, so a client written for an earlier build finds neither. The server advertises `listChanged`, meaning its tool list can change during a session, so check the live list before calling a tool; a shorter list alone does not establish a workspace or approval problem.

**Pass `workspaceIdentifier` even though it never appears in a `required` list.** It is required wherever tested, including `XcodeListSchemes` and `XcodeListTargets` with a single workspace open; treat it as required for all 46 tools that accept it. The error names the valid identifiers, so a missed one costs a round trip rather than a wrong-target write. Identifiers are short readable strings (`workspace-Gxw7GRzGoI`), not UUIDs, and come from `XcodeListWorkspaces`. On Xcode 26.x this parameter was `tabIdentifier`. It survived into Xcode 27 beta 5 on the running-Xcode path, and beta 6 removed it everywhere — along with `XcodeListWindows`, `XcodeGetCurrentFile`, and `XcodeListNavigatorIssues`. Code written against a beta-5 capture taken with Xcode open will break.

## Documentation Scope

This page documents the `xcode-mcp-ref` reference skill (in the `axiom-xcode-mcp` suite). For setup and connection guidance, including the headless server, see [Xcode MCP Setup](/skills/xcode-mcp/xcode-mcp-setup). For workflow patterns (workspace bootstrap, BuildFix loop, TestFix loop), see [Xcode MCP Tools](/skills/xcode-mcp/xcode-mcp-tools).

## Related

- [Xcode Debugging](/skills/debugging/xcode-debugging) – Environment diagnostics outside MCP (Derived Data, zombie `xcodebuild` processes), for when the problem is the Xcode environment rather than a tool call
- [Apple Documentation Access](/skills/integration/apple-docs) – The for-LLM guides bundled inside Xcode, a separate resource from the `DocumentationSearch` tool and the fallback when that tool is missing
- [Device Control](/reference/device-control-ref) – Drives simulators and devices from the command line without MCP
