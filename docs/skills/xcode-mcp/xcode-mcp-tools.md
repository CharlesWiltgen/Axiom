---
name: xcode-mcp-tools
description: Workflow patterns, window targeting, and tool-selection discipline for Xcode's MCP server — BuildFix and TestFix loops, preview verification, file-op safety
---

# Xcode MCP Tool Workflows

Discipline skill for using Xcode's 20 MCP tools in iterative workflows rather than isolated calls. Covers window targeting via `XcodeListWindows`, the BuildFix and TestFix loops, preview verification, issue-navigator-first triage, and the destructive-operation guard rails for `XcodeRM` and `XcodeMV`.

## When to Use

Use this skill when:
- Building, testing, or previewing a project via MCP tools rather than `xcodebuild`
- A tool call fails silently or targets the wrong project (almost always a stale tab identifier)
- Deciding between `XcodeUpdate` and `XcodeWrite` for an edit
- Choosing between MCP file tools and standard Read/Write/Grep
- Running test iterations and trying to avoid full-suite runs on every change
- Rendering SwiftUI previews to verify a layout change
- About to call `XcodeRM` or `XcodeMV` — both can break the project if invoked carelessly
- A strict MCP client rejects mcpbridge responses mid-workflow

## Example Prompts

- "Build my project using MCP tools"
- "Run just the failing test, not the whole suite"
- "Render the preview for my ContentView"
- "How do I target a specific Xcode window?"
- "Should I use XcodeWrite or XcodeUpdate to edit this file?"
- "My MCP tool calls keep hitting the wrong project — why?"
- "Can I delete this file via MCP?"

## What This Skill Provides

- **Window-targeting foundation** – `XcodeListWindows` first, cache the `tabIdentifier`, re-fetch only on failure or window change
- **BuildFix loop** – `BuildProject` → `GetBuildLog` → `XcodeListNavigatorIssues` → `XcodeUpdate` → repeat (max 5 iterations); fall back to environment-first diagnostics when the same error survives 3 attempts
- **TestFix loop** – `GetTestList` → `RunSomeTests` for fast iteration → `XcodeUpdate` → `RunAllTests` for final verification (saves minutes per cycle)
- **PreviewVerify workflow** – `RenderPreview` with the `previewDefinitionIndexInFile` parameter, before/after comparison
- **IssueTriage workflow** – Issue Navigator as canonical diagnostics source over grep-for-errors
- **File-operation decision table** – when MCP file tools beat standard Read/Write/Grep (generated files, package products, build context)
- **Destructive-operation rules** – confirm with user before `XcodeRM` or `XcodeMV`; understand Trash-by-default and import-breakage risks
- **Anti-patterns table** – "I'll just use xcodebuild", "Skip tab identifier", "Run all tests every time", "Parse the build log for errors", "XcodeWrite to update a file"
- **Tab-identifier staleness rules** – when identifiers become invalid (window closed, project closed, Xcode restarted)

## Related

- [Xcode MCP Setup](/skills/xcode-mcp/xcode-mcp-setup) – get connected before applying these workflows
- [Xcode MCP Reference](/reference/xcode-mcp-ref) – exact parameters and return shapes for every tool referenced here
- [Xcode Debugging](/skills/debugging/xcode-debugging) – environment-first fallback when BuildFix can't make progress (zombie processes, stale Derived Data, simulator issues)
