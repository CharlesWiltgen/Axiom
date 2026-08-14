---
name: xcode-mcp-ref
description: Complete parameter, return-shape, and behavior reference for all 54 tools exposed by Xcode's MCP server, captured live from Xcode 27
---

# Xcode MCP Tool Reference

Complete reference for every tool exposed by Xcode's MCP server — the Model Context Protocol interface that lets an AI assistant drive Xcode directly. Covers parameters, return shapes, and the behavioral caveats that the tool descriptions leave out. Generated from a live `tools/list` capture on Xcode 27 beta 5, not from documentation.

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

## Two Things That Trip Everyone Up

**The tool count changes.** The server exposes 53 tools with no workspace open and 54 with one — it advertises `capabilities.tools.listChanged: true`, and `DocumentationSearch` is the sole workspace-gated tool. A tool missing from `tools/list` may simply mean nothing is open yet.

**`workspaceIdentifier` is required even though it never appears in a `required` list.** All 46 tools that accept it demand it, even when a single workspace is open. The error names the valid identifiers, so a missed one costs a round trip rather than a wrong-target write. Identifiers are readable slugs (`workspace-Gxw7GRzGoI`), not UUIDs, and come from `XcodeListWorkspaces`. On Xcode 26.x this parameter was `tabIdentifier`, which no longer exists in any tool.

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
`RenderPreview`

### Device interaction
`DeviceInteractionStartSession`, `DeviceInteractionStartWorkspaceSession`, `DeviceInteractionInstallAndRun`, `DeviceInteractionSynthesize`, `DeviceInteractionEndSession`

### Crash & field diagnostics
`GetTopCrashIssues`, `GetCrashIssueLogs`, `GetTopFieldPerformanceIssues`, `GetFieldPerformanceIssueLogs`

### Localization & string catalogs
`LocalizationPlanner`, `StringCatalogContext`, `StringCatalogRead`, `StringCatalogEdit`

### Project configuration
`AddEntitlement`, `AddInfoPlist`

### Documentation
`DocumentationSearch`

Fifteen entries carry extra notes for caveats their schema descriptions bury — among them the word "test" being forbidden in `RunCodeSnippet`'s `purpose`, `XcodeRM` moving files to the Trash by default, `XcodeListTemplates` truncating to 100 of 193 templates, and `GetTestList` capping inline output at 100 tests.

## Documentation Scope

This page documents the `xcode-mcp-ref` reference skill. For setup and connection guidance, including the headless server, see [Xcode MCP Setup](/skills/xcode-mcp/xcode-mcp-setup). For workflow patterns (workspace bootstrap, BuildFix loop, TestFix loop), see [Xcode MCP Tools](/skills/xcode-mcp/xcode-mcp-tools).

- For environment diagnostics outside MCP (Derived Data, zombie xcodebuild processes), see [Xcode Debugging](/skills/debugging/xcode-debugging)
- For Apple's bundled for-LLM documentation guides, see [Apple Documentation Access](/skills/integration/apple-docs) — a separate resource from the `DocumentationSearch` tool
- For driving simulators and devices without MCP, see [Device Control](/reference/device-control-ref)
