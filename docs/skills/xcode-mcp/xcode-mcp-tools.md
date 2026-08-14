---
name: xcode-mcp-tools
description: Workflow patterns, workspace targeting, and tool-selection discipline for Xcode's MCP server — headless bootstrap, BuildFix and TestFix loops, preview verification, file-op safety
---

# Xcode MCP Tool Workflows

How to use Xcode's 54 MCP tools in iterative workflows rather than isolated calls. Covers workspace targeting via `XcodeListWorkspaces`, bootstrapping a session when nothing is open, the BuildFix and TestFix loops, preview verification, diagnostics triage, and the destructive-operation guard rails for `XcodeRM` and `XcodeMV`.

## When to Use

Use this skill when:
- Building, testing, or previewing a project via MCP tools rather than `xcodebuild`
- Starting work with no workspace open — the normal headless case
- A call fails with `workspaceIdentifier is required for this action`
- Deciding between `XcodeUpdate` and `XcodeWrite` for an edit
- Choosing between MCP file tools and standard Read/Write/Grep
- Running test iterations and trying to avoid full-suite runs on every change
- Rendering SwiftUI previews to verify a layout change
- About to call `XcodeRM` or `XcodeMV` — both can break the project if invoked carelessly
- A tool call hangs with no error at all

## Example Prompts

- "Build my project using MCP tools"
- "Open my project through MCP without launching Xcode"
- "Run just the failing test, not the whole suite"
- "Render the preview for my ContentView"
- "Why does it say workspaceIdentifier is required when I only have one project open?"
- "Should I use XcodeWrite or XcodeUpdate to edit this file?"
- "Can I delete this file via MCP?"

## What This Skill Provides

- **Workspace-targeting foundation** – `XcodeListWorkspaces` first, cache the identifier, and why it's required even with a single workspace open despite never appearing in a `required` list
- **Workspace bootstrap** – list, then open an existing project or create one with `XcodeListTemplates` and `XcodeNewProject`; how to read `No workspaces are currently open.` as a starting state rather than a failure
- **BuildFix loop** – `BuildProject` → `GetBuildLog` (filtered by severity) → `XcodeRefreshCodeIssuesInFile` → `XcodeUpdate` → repeat (max 5 iterations); fall back to environment-first diagnostics when the same error survives 3 attempts
- **TestFix loop** – `GetTestList` → `RunSomeTests` for fast iteration → `XcodeUpdate` → `RunAllTests` for final verification, plus the `{targetName, testIdentifier}` specifier shape and the 100-test inline cap
- **PreviewVerify workflow** – `RenderPreview` with `previewDefinitionIndexInFile`, localization and variant overrides, before/after comparison
- **IssueTriage workflow** – server-side severity, pattern, and glob filtering on `GetBuildLog` for project-wide diagnostics; `XcodeRefreshCodeIssuesInFile` for a single file
- **File-operation decision table** – when MCP file tools beat standard Read/Write/Grep (generated files, package products, build context)
- **Destructive-operation rules** – confirm with the user before `XcodeRM` or `XcodeMV`; Trash-by-default and import-breakage risks, and the fact that `XcodeWrite` overwrites wholesale
- **The blocked-dialog trap** – an unapproved agent hangs indefinitely on a dialog nobody sees, while `initialize` succeeds and status looks healthy; includes the pre-flight check
- **Anti-patterns table** – "I'll just use xcodebuild", "Skip the identifier", "No workspace is open so MCP is broken", "The call is just slow", "Parse the build log for errors"

## Related

- [Xcode MCP Setup](/skills/xcode-mcp/xcode-mcp-setup) – get connected, in attached or headless mode, before applying these workflows
- [Xcode MCP Reference](/reference/xcode-mcp-ref) – exact parameters and return shapes for every tool referenced here
- [Xcode Debugging](/skills/debugging/xcode-debugging) – environment-first fallback when BuildFix can't make progress (zombie processes, stale Derived Data, simulator issues)
