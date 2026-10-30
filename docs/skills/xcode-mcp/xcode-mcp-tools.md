---
name: xcode-mcp-tools
description: Workflow patterns, workspace targeting, and tool-selection discipline for Xcode's MCP server — headless bootstrap, BuildFix and TestFix loops, preview verification, file-op safety
---

# Xcode MCP Tool Workflows

How to use Xcode's MCP tools in iterative workflows, from targeting a workspace and opening one when nothing is open, through the BuildFix and TestFix loops and preview verification, to safe use of the destructive `XcodeRM` and `XcodeMV`. It includes the schema differences verified on Xcode 27.2 (27B52, the same as its RC) and 27.2 beta 2 (27B5028f).

## When to Use

Use this skill when:
- Building, testing, or previewing a project via MCP tools rather than `xcodebuild`
- Starting work with no workspace open — the normal headless case
- A call fails with `workspaceIdentifier is required for this action`
- Deciding between `XcodeUpdate` and `XcodeWrite` for an edit
- Choosing between MCP file tools and your assistant's standard file tools
- Running test iterations and trying to avoid full-suite runs on every change
- Rendering SwiftUI previews to verify a layout change
- Rendering an interactive preview or choosing a preview render destination on Xcode 27.2
- `DocumentationSearch` or `GetCodeCoverage` is missing from the tool list
- About to call `XcodeRM` or `XcodeMV` — both can break the project if invoked carelessly
- A tool call is rejected with "This agent isn't approved to use Xcode's tools yet" — or, on Xcode 27 beta 5 and earlier, hangs with no error at all

## Example Prompts

- "Build my project using MCP tools"
- "Open my project through MCP without launching Xcode"
- "Run just the failing test, not the whole suite"
- "Render the preview for my ContentView"
- "Render my preview interactively and capture it after two seconds"
- "Render my preview on one of the destinations Xcode lists"
- "Inspect this variable using InvokeDebuggerCommand"
- "Why is GetCodeCoverage missing from my tool list?"
- "Why does it say workspaceIdentifier is required when I only have one project open?"
- "Should I use XcodeWrite or XcodeUpdate to edit this file?"
- "Can I delete this file via MCP?"

## What This Skill Provides

- **Workspace targeting and bootstrap** – `XcodeListWorkspaces` first, then open an existing project with `XcodeOpenWorkspace` or create one with `XcodeListTemplates` and `XcodeNewProject`; cache the returned identifier for targeted calls, even when only one project is open
- **BuildFix loop** – `BuildProject` → `GetBuildLog` (filtered by severity) → `XcodeRefreshCodeIssuesInFile` → `XcodeUpdate` → repeat (max 5 iterations); fall back to environment-first diagnostics when the same error survives 3 attempts
- **TestFix loop** – `GetTestList` → `RunSomeTests` for fast iteration → `XcodeUpdate` → `RunAllTests` for final verification, plus the `{targetName, testIdentifier}` specifier shape and the 100-test inline cap
- **PreviewVerify workflow** – localization, variant, and group-item overrides; interactive capture with a snapshot delay on Xcode 27.2; destination selection on 27.2 builds, with a check that the requested destination was actually used; and the output fields renamed from the 27.2 RC, which clients written for earlier builds miss
- **Debugger inspection** – attaching the debugger and checking that the process is stopped, plus the tool's advice, since 27.2 beta 2, to inspect variables with `p` or `v`
- **IssueTriage workflow** – server-side severity, pattern, and glob filtering on `GetBuildLog` for project-wide diagnostics; `XcodeRefreshCodeIssuesInFile` for a single file
- **File-operation choices and safety** – when MCP tools provide project context, when standard tools suffice, why `XcodeWrite` overwrites wholesale, and confirmation before `XcodeRM` or `XcodeMV`
- **The unapproved-agent trap** – on Xcode 27.0 an unapproved agent's tool calls are rejected with "This agent isn't approved…" (beta 5 and earlier hung indefinitely on a dialog nobody saw, while `initialize` succeeded and status looked healthy); includes the `Permitted agents` pre-flight check
- **Build-specific tool availability** – `DocumentationSearch` is absent from both measured 27.2 beta 2 listings and back on the 27.2 RC and release; `GetCodeCoverage`, announced in the 27.2 prerelease notes, isn't in the release
- **Anti-patterns table** – "I'll just use xcodebuild", "Skip the identifier, I only have one project", "No workspace is open, so MCP is broken", "tools/list worked, so I'm approved", "I'll parse the build log for errors"

## Documentation Scope

This page documents the `xcode-mcp-tools` skill in the `axiom-xcode-mcp` suite. The skill file holds the full guidance your assistant draws on, including each workflow's call sequence, the preview-destination examples, and the anti-patterns table.

## Related

- [Xcode MCP Setup](/skills/xcode-mcp/xcode-mcp-setup) – Get connected, in attached or headless mode, before applying these workflows
- [Xcode MCP Reference](/reference/xcode-mcp-ref) – Exact parameters and return shapes for every tool referenced here
- [Xcode Debugging](/skills/debugging/xcode-debugging) – Environment-first fallback when BuildFix can't make progress (zombie processes, stale Derived Data, simulator issues)
