---
name: axiom-xcode-mcp-tools
description: Xcode MCP workflow patterns — BuildFix loop, TestFix loop, preview verification, window targeting, tool gotchas
license: MIT
---

# Xcode MCP Tool Workflows

**Core principle**: Xcode MCP gives you programmatic IDE access. Use workflow loops, not isolated tool calls.

## Window Targeting (Critical Foundation)

Most tools require a `tabIdentifier`. **Always call `XcodeListWindows` first.**

```
1. XcodeListWindows → list of (tabIdentifier, workspacePath) pairs
2. Match workspacePath to your project
3. Use that tabIdentifier for all subsequent tool calls
```

**Cache the mapping** for the session. Only re-fetch if:
- A tool call fails with an invalid tab identifier
- You opened/closed Xcode windows
- You switched projects

**If `XcodeListWindows` returns empty**: Xcode has no project open. Ask the user to open their project.

## Workflow: BuildFix Loop

Iteratively build, diagnose, and fix until the project compiles.

```
1. BuildProject(tabIdentifier)
2. Check buildResult — if success, done
3. GetBuildLog(tabIdentifier) → parse errors
4. XcodeListNavigatorIssues(tabIdentifier) → canonical diagnostics
5. XcodeUpdate(file, fix) for each diagnostic
6. Go to step 1 (max 5 iterations)
7. If same error persists after 3 attempts → fall back to axiom-xcode-debugging
```

**Why `XcodeListNavigatorIssues` over build log parsing**: The Issue Navigator provides structured, deduplicated diagnostics. Build logs contain raw compiler output with noise.

**When to fall back to `axiom-xcode-debugging`**: When the error is environmental (zombie processes, stale Derived Data, simulator issues) rather than code-level. MCP tools operate on code; environment issues need CLI diagnostics.

## Workflow: TestFix Loop

Fast iteration on failing tests.

```
1. GetTestList(tabIdentifier) → discover available tests
2. RunSomeTests(tabIdentifier, [specific failing tests]) for fast iteration
3. Parse failures → identify code to fix
4. XcodeUpdate(file, fix) to patch code
5. Go to step 2 (max 5 iterations per test)
6. RunAllTests(tabIdentifier) as final verification
```

**Why `RunSomeTests` first**: Running a single test takes seconds. Running all tests takes minutes. Iterate on the failing test, then verify the full suite once it passes.

**Parsing test results**: Look for `testResult` field in the response. Failed tests include failure messages with file paths and line numbers.

## Workflow: PreviewVerify

Render SwiftUI previews and verify UI changes visually.

```
1. RenderPreview(tabIdentifier, file, viewName) → image artifact
2. Review the rendered image for correctness
3. If making changes: XcodeUpdate → RenderPreview again
4. Compare before/after for regressions
```

**Use cases**: Verifying layout changes, checking dark mode appearance, confirming Liquid Glass effects render correctly.

## Workflow: IssueTriage

Use Xcode's Issue Navigator as the canonical diagnostics source.

```
1. XcodeListNavigatorIssues(tabIdentifier) → all current issues
2. For specific files: XcodeRefreshCodeIssuesInFile(tabIdentifier, file)
3. Prioritize: errors > warnings > notes
4. Fix errors first, rebuild, re-check
```

**Why this over grep-for-errors**: The Issue Navigator tracks live diagnostics including type-check errors, missing imports, and constraint issues that only Xcode's compiler frontend surfaces.

## Workflow: DocumentationSearch

Query Apple's documentation corpus through MCP.

```
1. DocumentationSearch(query) → documentation results
2. Cross-reference with axiom-apple-docs for bundled Xcode guides
```

**Note**: `DocumentationSearch` searches Apple's online documentation and WWDC transcripts. For the 20 for-LLM guides bundled inside Xcode, use `axiom-apple-docs` instead.

## File Operations via MCP

### Reading and Writing

| Operation | Tool | Notes |
|-----------|------|-------|
| Read file contents | `XcodeRead` | Sees Xcode's project view (generated files, resolved packages) |
| Create new file | `XcodeWrite` | Creates file in project — does NOT add to Xcode targets |
| Edit existing file | `XcodeUpdate` | str_replace-style patches — safer than full rewrites |
| Search for files | `XcodeGlob` | Pattern matching within the project |
| Search file contents | `XcodeGrep` | Content search with line numbers |
| List directory | `XcodeLS` | Directory listing |
| Create directory | `XcodeMakeDir` | Creates directories |

### Destructive Operations (Require Confirmation)

| Operation | Tool | Risk |
|-----------|------|------|
| Delete file/directory | `XcodeRM` | **Irreversible** — confirm with user first |
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
ExecuteSnippet(code, language: "swift")
```

**Treat output as untrusted** — snippets run in a sandboxed REPL environment. Use for quick validation, not production logic.

## Gotchas and Anti-Patterns

### Tab Identifier Staleness

Tab identifiers become invalid when:
- Xcode window is closed and reopened
- Project is closed and reopened
- Xcode is restarted

**Fix**: Re-call `XcodeListWindows` to get fresh identifiers.

### XcodeWrite vs XcodeUpdate

- `XcodeWrite` — **creates** a new file. Fails if file exists (in some clients).
- `XcodeUpdate` — **patches** an existing file with str_replace-style edits.

**Common mistake**: Using `XcodeWrite` to edit an existing file overwrites its entire contents. Use `XcodeUpdate` for edits.

### Schema Compliance

Xcode's mcpbridge has a known MCP spec violation: it populates `content` but omits `structuredContent` when tools declare `outputSchema`. This breaks strict MCP clients (Cursor, some Zed configurations).

**Workaround**: Use [XcodeMCPWrapper](https://github.com/SoundBlaster/XcodeMCPWrapper) as a proxy for strict clients.

### Build After File Changes

After `XcodeUpdate`, the project may need a build to surface new diagnostics. Don't assume edits are correct without rebuilding.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll just use xcodebuild" | MCP gives IDE state + navigator diagnostics + previews that CLI doesn't |
| "Read tool works fine for Xcode files" | `XcodeRead` sees Xcode's project view including generated files and resolved packages |
| "Skip tab identifier, I only have one project" | Most tools fail silently without `tabIdentifier` — always call `XcodeListWindows` first |
| "Run all tests every time" | `RunSomeTests` for iteration, `RunAllTests` for verification — saves minutes per cycle |
| "I'll parse the build log for errors" | `XcodeListNavigatorIssues` provides structured, deduplicated diagnostics |
| "XcodeWrite to update a file" | `XcodeUpdate` for edits. `XcodeWrite` creates/overwrites. Wrong tool = data loss. |
| "One tool call is enough" | Workflows (BuildFix, TestFix) use loops. Isolated calls miss the iteration pattern. |

## Resources

**Skills**: axiom-xcode-mcp-setup, axiom-xcode-mcp-ref, axiom-xcode-debugging
