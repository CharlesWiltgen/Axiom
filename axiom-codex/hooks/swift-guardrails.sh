#!/bin/bash
# Swift Guardrails — PostToolUse hook for file edits on .swift files.
# Catches iOS-specific issues (currently: @State without an explicit access level)
# as code is written, emitting decision:"block" so the agent fixes them in place.
#
# Harness-agnostic input boundary — reads tool_input from the stdin JSON, never an
# env var, so ONE script serves both harnesses (bd axiom-tybr):
#   - Claude Code Write/Edit: tool_input.file_path is a single (absolute) path.
#   - Codex apply_patch:       tool_input is a freeform, multi-file patch; affected
#     paths come from its "*** Update File:" / "*** Add File:" headers and are
#     workspace-relative, so they are resolved against the stdin `cwd`.
# A small Python extractor normalizes both into a newline-separated path list; the
# @State check core is shared. Malformed/empty stdin → no paths → exit 0. The hook
# never fails: a broken guardrail must never block a legitimate edit.

STDIN_JSON=$(cat)

# Normalize either harness's tool_input shape into a list of affected .swift paths.
AFFECTED_FILES=$(printf '%s' "$STDIN_JSON" | python3 -c '
import json, os, re, sys

def parse_patch(text):
    # apply_patch headers: "*** Update File: <path>" / "*** Add File: <path>".
    # Delete File is ignored — nothing remains on disk to check.
    out = []
    for line in text.splitlines():
        m = re.match(r"\*\*\* (?:Update|Add) File: (.+)", line)
        if m:
            out.append(m.group(1).strip())
    return out

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
if not isinstance(data, dict):
    sys.exit(0)

cwd = data.get("cwd")
ti = data.get("tool_input")
paths = []
if isinstance(ti, dict):
    fp = ti.get("file_path")
    if isinstance(fp, str) and fp:
        paths.append(fp)  # Claude Code Write/Edit
    # Codex apply_patch delivers the freeform multi-file patch under a key (confirmed
    # "command" in Codex 0.142). Scan every string value for patch headers so the
    # check does not hinge on the exact key name.
    for v in ti.values():
        if isinstance(v, str) and "*** " in v:
            paths.extend(parse_patch(v))
elif isinstance(ti, str):
    paths.extend(parse_patch(ti))  # defensive: bare patch string

seen = set()
for p in paths:
    if not p.endswith(".swift"):
        continue
    # apply_patch paths are workspace-relative; resolve against the cwd the harness
    # reports on stdin so the on-disk check works regardless of the cwd the hook
    # process was spawned with. Claude Code file_path is already absolute.
    if not os.path.isabs(p) and isinstance(cwd, str) and cwd:
        p = os.path.join(cwd, p)
    if p not in seen:
        seen.add(p)
        print(p)
' 2>/dev/null)

[[ -z "$AFFECTED_FILES" ]] && exit 0

# --- Shared @State check core ---
# @State without an explicit access level lets child views create their own source
# of truth, causing silent state bugs. The grep chain drops false positives:
#   2. an access modifier on either side of @State (@State private var / private @State var)
#   3. the axiom-ignore escape hatch
#   4. a "//" comment that precedes the match (commented-out code, doc comments)
#   5. "@State var" appearing inside a string literal
# (A trailing "// ... @State var ..." comment can over-suppress a real match, but that
# fails safe — a missed warning, never a wrong block.)
check_state() {
  grep -nE '@State[[:space:]]+var[[:space:]]' "$1" 2>/dev/null \
    | grep -vE '(private|fileprivate|internal|public|package|open)[[:space:]]+@State|@State[[:space:]]+(private|fileprivate|internal|public|package|open)' \
    | grep -vE '// *axiom-ignore' \
    | grep -vE '//.*@State[[:space:]]+var' \
    | grep -vE '".*@State[[:space:]]+var'
}

ISSUES=""
CRITICAL=false

while IFS= read -r FILE_PATH; do
  [[ -z "$FILE_PATH" ]] && continue
  [[ "$FILE_PATH" != *.swift ]] && continue
  # PostToolUse runs after the edit, so the file is on disk. A path we can't resolve
  # is skipped, not failed.
  [[ ! -f "$FILE_PATH" ]] && continue
  LINES=$(check_state "$FILE_PATH" | head -3)
  if [[ -n "$LINES" ]]; then
    # Build with real newlines (not \n escapes) so the message is handed to json.dumps
    # literally — no printf %b round-trip that could mangle Swift backslash escapes.
    ISSUES="${ISSUES}
⚠️ ${FILE_PATH}: @State var without access control (should be @State private var):
${LINES}
"
    CRITICAL=true
  fi
done <<< "$AFFECTED_FILES"

if [[ "$CRITICAL" == "true" ]]; then
  # json.dumps gives correct escaping of backslashes, control chars, and quotes —
  # sed-only escaping breaks for Swift files containing `\`.
  ESCAPED_ISSUES=$(printf '%s' "$ISSUES" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
  cat <<ENDJSON
{
  "decision": "block",
  "reason": "Swift guardrail: @State properties must have an explicit access level (usually private). Without it, child views can create independent copies of the state, causing silent bugs. Fix: change @State var to @State private var.",
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": ${ESCAPED_ISSUES}
  }
}
ENDJSON
fi

exit 0
