#!/bin/sh
# Install Axiom's pre-commit validation into .git/hooks/pre-commit.
#
# Why an installer exists: .git/hooks is not tracked, so a guard that lives only
# there disappears on a fresh clone and on any machine that never ran it. The
# block is spliced between markers, so re-running replaces it instead of stacking
# copies, and any other content in the hook (the beads integration, for instance)
# is left alone.
#
#   sh scripts/install-git-hooks.sh
set -e

root=$(cd "$(dirname "$0")/.." && pwd)
source_file="$root/scripts/git-hooks/pre-commit-axiom.sh"
hook="$root/.git/hooks/pre-commit"

test -f "$source_file" || { echo "missing $source_file" >&2; exit 1; }
test -d "$root/.git/hooks" || { echo "$root is not a git checkout" >&2; exit 1; }

if [ ! -f "$hook" ]; then
  printf '#!/bin/sh\n' > "$hook"
  chmod +x "$hook"
fi

# Splice only the marked block. The tracked file's shebang and preamble exist so
# it can be run directly; neither belongs in the middle of another hook.
BEGIN='# --- BEGIN AXIOM PLUGIN VALIDATION ---'
END='# --- END AXIOM PLUGIN VALIDATION ---'
awk -v begin="$BEGIN" -v end="$END" '
  $0 == begin { inside = 1 }
  inside { print }
  $0 == end { inside = 0 }
' "$source_file" > "$root/.git/hooks/.axiom-block.tmp"

if grep -qF "$BEGIN" "$hook"; then
  awk -v begin="$BEGIN" -v end="$END" -v block="$root/.git/hooks/.axiom-block.tmp" '
    BEGIN { while ((getline line < block) > 0) replacement = replacement line "\n" }
    $0 == begin { printf "%s", replacement; skip = 1; next }
    skip && $0 == end { skip = 0; next }
    !skip { print }
  ' "$hook" > "$root/.git/hooks/.pre-commit.tmp"
  mv "$root/.git/hooks/.pre-commit.tmp" "$hook"
  echo "  replaced the axiom block in .git/hooks/pre-commit"
else
  printf '\n' >> "$hook"
  cat "$root/.git/hooks/.axiom-block.tmp" >> "$hook"
  echo "  appended the axiom block to .git/hooks/pre-commit"
fi

rm -f "$root/.git/hooks/.axiom-block.tmp"
chmod +x "$hook"
sh -n "$hook" && echo "  hook syntax ok"
