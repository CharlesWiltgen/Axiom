// Single source of truth for translating Axiom's Claude Code hooks manifest into
// the Codex plugin's hooks.json. Imported by scripts/build-codex.ts (the builder)
// and exercised by scripts/codex-hooks.test.ts — mirroring the codex-exclude.js
// precedent: a .js module imported with an explicit `.js` extension, because root
// scripts run under bare-node type-stripping.
//
// Codex hooks (codex-rs/hooks/) are deliberately Claude-Code-compatible: same
// hooks.json shape, same event names, same hookSpecificOutput.additionalContext
// output contract (verified 2026-06-24 — see bd axiom-25ll). So the manifest
// translation is mechanical:
//   1. Rewrite the plugin-root variable ${CLAUDE_PLUGIN_ROOT} -> ${PLUGIN_ROOT}
//      (Codex runs hook commands through `sh -lc`, so $PLUGIN_ROOT shell-expands).
//   2. Drop matcher groups Codex can't fire: matcher "Read" has no Codex tool
//      (canonical hookable tools are apply_patch [aliases Write/Edit], Bash,
//      spawn_agent, MCP tools). crash-route (matcher "Read") is excluded here;
//      re-triggering it via UserPromptSubmit is a documented follow-up.
//   3. Drop `matcher` on events where Codex doesn't support it (UserPromptSubmit, Stop).
//
// No per-hook command rewriting is needed beyond the plugin-root rename: the
// format-on-save hook was retired and swift-guardrails.py reads tool_input from the
// stdin JSON (Claude Code file_path OR a Codex apply_patch patch), so it is
// harness-agnostic and ports with no special transform or exclusion (bd axiom-tybr).

// Tool matchers with no Codex equivalent → their hook groups are dropped. Codex's
// canonical hookable tools are apply_patch (matcher aliases Write/Edit), Bash,
// spawn_agent (alias Agent), and MCP tools — there is no Read tool, so a group
// matched solely by "Read" (Axiom's crash-route) can never fire and is excluded.
// Exported so the L5 pre-deploy fidelity gate computes expected coverage without drift.
export const UNSUPPORTED_TOOL_MATCHERS = new Set(['Read']);

// Events where Codex does not support a `matcher` field (any matcher is stripped).
export const MATCHERLESS_EVENTS = new Set(['UserPromptSubmit', 'Stop']);

// Hook SCRIPTS that back only dropped hooks, so the Codex build must not copy them.
// pretool-crash-route.py backs the "Read" PreToolUse group (UNSUPPORTED_TOOL_MATCHERS) —
// with no Codex Read tool it can never fire. Kept beside the matcher exclusion as the
// single source the hooks/ copy filters against.
export const CODEX_EXCLUDED_HOOK_SCRIPTS = new Set(['pretool-crash-route.py']);

// Codex injects $PLUGIN_ROOT for plugin-bundled hooks and runs the command via
// `sh -lc`, so the variable shell-expands exactly like Claude Code's ${CLAUDE_PLUGIN_ROOT}.
function rewriteCommand(command) {
  return command.replaceAll('CLAUDE_PLUGIN_ROOT', 'PLUGIN_ROOT');
}

/**
 * @typedef {{ type: string, command?: string }} HookEntry
 * @typedef {{ matcher?: string, hooks: HookEntry[] }} HookGroup
 * @typedef {{ hooks: Record<string, HookGroup[]> }} HooksManifest
 */

/**
 * Translate a Claude Code hooks manifest into its Codex plugin equivalent.
 * @param {HooksManifest} ccHooks
 * @returns {HooksManifest}
 */
export function translateHooksToCodex(ccHooks) {
  /** @type {Record<string, HookGroup[]>} */
  const outHooks = {};
  for (const [event, groups] of Object.entries(ccHooks.hooks ?? {})) {
    const translatedGroups = [];
    for (const group of groups) {
      // Drop groups Codex can't fire (matcher names a tool with no Codex equivalent).
      if (group.matcher !== undefined && UNSUPPORTED_TOOL_MATCHERS.has(group.matcher)) {
        continue;
      }
      const newGroup = {};
      // Keep the matcher unless this event doesn't support one.
      if (group.matcher !== undefined && !MATCHERLESS_EVENTS.has(event)) {
        newGroup.matcher = group.matcher;
      }
      newGroup.hooks = (group.hooks ?? []).map((entry) =>
        typeof entry.command === 'string'
          ? { ...entry, command: rewriteCommand(entry.command) }
          : { ...entry },
      );
      translatedGroups.push(newGroup);
    }
    // Drop an event whose groups were all excluded (e.g. PreToolUse → only "Read").
    if (translatedGroups.length > 0) {
      outHooks[event] = translatedGroups;
    }
  }
  return { hooks: outHooks };
}

/**
 * True if a file in the source hooks/ directory should be copied into the Codex
 * plugin: a runtime .py/.sh script, excluding test files and scripts that back only
 * dropped hooks. Used as a DENYLIST so transitive deps (session-start.py,
 * project_detect.py — pulled in by session-start.sh but absent from hooks.json) are
 * copied automatically.
 * @param {string} filename
 * @param {Set<string>} [excluded]
 * @returns {boolean}
 */
export function shouldCopyHookScript(filename, excluded = CODEX_EXCLUDED_HOOK_SCRIPTS) {
  if (excluded.has(filename)) return false;
  if (filename.endsWith('_test.py')) return false;
  return filename.endsWith('.py') || filename.endsWith('.sh');
}
