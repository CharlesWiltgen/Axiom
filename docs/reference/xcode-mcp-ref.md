---
name: xcode-mcp-ref
description: Complete parameter, return-shape, and behavior reference for all 20 tools exposed by Xcode's MCP server (`xcrun mcpbridge`), validated against Xcode 26.3
---

# Xcode MCP Tool Reference

Complete reference for the 20 tools exposed by Xcode 26.3's MCP server (`xcrun mcpbridge`). Sources, schemas, and behavioral notes validated against Xcode 26.3's `tools/list` response and Keith Smiley's 2025-07-15 gist.

## When to Use This Reference

Use this reference when:
- Looking up the exact parameter list for a specific MCP tool
- Checking the return-shape contract for `BuildProject`, `RunAllTests`, `XcodeListNavigatorIssues`, etc.
- Verifying which parameters are required versus optional
- Determining which tools accept `tabIdentifier` (18 of 20 do)
- Choosing between near-equivalent tools (`XcodeUpdate` vs `XcodeWrite`, `RunAllTests` vs `RunSomeTests`, `XcodeRead` vs `XcodeLS`)
- Reading the structured output of `GetBuildLog` or `XcodeListNavigatorIssues`
- Understanding `RenderPreview`'s `previewDefinitionIndexInFile` semantics
- Translating an MCP tool name to its category (discovery, file, build, test, diagnostics, execution, preview, search)

## Example Prompts

- "What parameters does BuildProject take?"
- "What does GetBuildLog return?"
- "How does XcodeGrep work?"
- "What's the difference between RunSomeTests and RunAllTests?"
- "Does RenderPreview pick previews by name or index?"
- "Which tools don't need a tabIdentifier?"
- "What's the return shape of XcodeListNavigatorIssues?"

## What's Covered

- **Discovery** — `XcodeListWindows` (the only tool with no `tabIdentifier`)
- **File reads** — `XcodeRead` (cat -n format with `limit`/`offset`), `XcodeGlob`, `XcodeGrep` (ripgrep-like interface with `outputMode`, context flags, line numbers), `XcodeLS`
- **File writes** — `XcodeWrite` (create/overwrite, auto-adds to project), `XcodeUpdate` (str_replace-style with `replaceAll`), `XcodeMakeDir`
- **File destructive** — `XcodeRM` (Trash by default via `deleteFiles`), `XcodeMV` (move or copy, may break imports)
- **Build** — `BuildProject` (returns `buildResult`, `elapsedTime`, structured `errors[]`), `GetBuildLog` (severity/pattern/glob filtering, returns `buildLogEntries[]` not raw text)
- **Test** — `RunAllTests`, `RunSomeTests` (takes `{targetName, testIdentifier}[]`), `GetTestList` (returns `tests[]` with file paths, line numbers, tags)
- **Diagnostics** — `XcodeListNavigatorIssues` (structured, deduplicated, includes `vitality` fresh/stale flag), `XcodeRefreshCodeIssuesInFile`
- **Execution** — `ExecuteSnippet` (runs in the context of a specific Swift source file with access to its `fileprivate` declarations; not a REPL; Swift only)
- **Preview** — `RenderPreview` (index-based selection via `previewDefinitionIndexInFile`, returns `previewSnapshotPath`)
- **Search** — `DocumentationSearch` (local semantic search of Apple Developer Documentation, MLX-accelerated; not web search)
- **Common parameter patterns** — `tabIdentifier` (18/20 tools), `filePath` vs `path` vs `directoryPath` vs `sourceFilePath`
- **Quick-reference category table** mapping all 20 tools to their domain

## Documentation Scope

This page documents the `xcode-mcp-ref` reference skill. For setup and connection guidance, see [Xcode MCP Setup](/skills/xcode-mcp/xcode-mcp-setup). For workflow patterns (BuildFix loop, TestFix loop, when to use MCP versus standard tools), see [Xcode MCP Tools](/skills/xcode-mcp/xcode-mcp-tools).

- For environment diagnostics outside MCP (Derived Data, zombie xcodebuild processes), see [Xcode Debugging](/skills/debugging/xcode-debugging)
- For Apple's bundled for-LLM documentation guides, see [Apple Documentation Access](/skills/integration/apple-docs) — `DocumentationSearch` searches the online corpus, while the bundled guides are a separate resource
