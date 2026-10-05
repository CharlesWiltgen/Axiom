#!/bin/sh
# --- BEGIN AXIOM PLUGIN VALIDATION ---
# Installed by scripts/install-git-hooks.sh. Edit the tracked copy at
# scripts/git-hooks/pre-commit-axiom.sh, not this generated block.

# Content scan on EVERY commit, whatever the paths: the private-data class has
# come through tools/, fixtures and binaries, so it cannot be gated on staged
# surfaces. Runs under plain node (Node 24 strips types); `npx tsx` would resolve
# from the network, and a failed download must not read as a leak finding.
_axiom_leaks=$(node scripts/leak-scan.ts 2>&1)
_axiom_status=$?
if [ $_axiom_status -ne 0 ]; then
  # Print what the scanner said BEFORE diagnosing it. An earlier revision filtered
  # the captured output to `^  ✗|error(s)`, which discards everything when the
  # scanner crashes rather than reports — a stack trace then produced the
  # confident but unsupported diagnosis "private data in shipped content".
  # A `✗` line is a finding; the absence of one means the scanner itself failed,
  # and those two need different words.
  if printf '%s\n' "$_axiom_leaks" | grep -q '^  ✗'; then
    printf '%s\n' "$_axiom_leaks" | grep '^  ✗' | head -20 >&2
    echo >&2 "axiom: leak scan FAILED — see the findings above."
    echo >&2 "        Full report: node scripts/leak-scan.ts"
  else
    echo >&2 "axiom: the leak scan itself failed (exit $_axiom_status) — not a leak finding."
    printf '%s\n' "$_axiom_leaks" | head -20 >&2
  fi
  exit 1
fi

# Runs when plugin, docs, README, scripts or tools files are staged.
# docs/ and README.md are IN SCOPE because checks 12c/12e/12i/12j scan them — a
# docs-only commit previously skipped validation entirely, which is how six
# docs-dash violations shipped past the very gate meant to catch them.
# tools/ is IN SCOPE because two rounds of the private-data class lived there.
# axiom-codex/, axiom-cursor/, the Cursor and Codex marketplace manifests and the
# root package.json are IN SCOPE because they ship from this checkout and have
# gates of their own: a hand edit committed on its own skipped validation (Axiom-fe9f).
# Pre-deploy itself writes only to the temp directory, where check 12f renders the
# Codex variant; the render it spawns runs with full permissions under --allow-run.
# TMP and TEMP are the fallbacks os.tmpdir() uses when TMPDIR is unset.
_axiom_staged=$(git diff --cached --name-only -- '.claude-plugin/' 'docs/' 'README.md' 'scripts/' 'tools/' 'axiom-codex/' 'axiom-cursor/' '.cursor-plugin/' '.agents/' 'package.json' 2>/dev/null)
if [ -n "$_axiom_staged" ]; then
  echo "axiom: plugin/docs files staged — running validation..."
  if ! deno run --allow-read --allow-run --allow-env --allow-write="${TMPDIR:-${TMP:-${TEMP:-/tmp}}}" scripts/pre-deploy.ts --static 2>&1; then
    echo >&2 "axiom: pre-deploy validation FAILED — fix before committing"
    exit 1
  fi
fi
# --- END AXIOM PLUGIN VALIDATION ---
