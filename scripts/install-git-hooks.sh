#!/bin/sh
# Install Axiom's pre-commit validation into .git/hooks/pre-commit.
#
# Why an installer exists: .git/hooks is not tracked, so a guard that lives only
# there disappears on a fresh clone and on any machine that never ran it. The
# block is spliced between markers, so re-running moves it rather than stacking
# copies, and any other content in the hook (the beads integration, for instance)
# is left alone.
#
#   sh scripts/install-git-hooks.sh
set -e

root=${AXIOM_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}
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

# Strip any block a previous run installed, THEN insert the current one after the
# shebang. Unconditional, and in that order, because a block that is already there
# may be in the wrong place: the first revision appended, so an installed block can
# sit after another tool's `exit` and never run. Replacing it in place would
# preserve that position; stripping first moves it.
tmp_stripped="$root/.git/hooks/.pre-commit.stripped"
tmp_placed="$root/.git/hooks/.pre-commit.placed"

awk -v begin="$BEGIN" -v end="$END" '
  $0 == begin { skip = 1; next }
  skip && $0 == end { skip = 0; next }
  !skip { print }
' "$hook" > "$tmp_stripped"

# Insert right after the shebang — NOT at the end. An existing hook file may
# already carry another tool's block, and a block that terminates the script
# (an `exit`, an `exec`) would leave this one unreachable while the installer
# still reported success. The sibling installer
# (.claude/scripts/install-leak-prevention-hooks.sh) prepends for this reason,
# and this repo's own .git/hooks/pre-commit is exactly that case: the beads
# block carries `if [ $_bd_exit -ne 0 ]; then exit $_bd_exit; fi`.
awk -v block="$root/.git/hooks/.axiom-block.tmp" '
  BEGIN {
    while ((getline line < block) > 0) body = body line "\n"
    placed = 0
  }
  !placed && NR == 1 && /^#!/ { print; printf "\n%s\n", body; placed = 1; next }
  !placed { printf "%s\n", body; placed = 1 }
  { print }
  END { if (!placed) printf "\n%s\n", body }
' "$tmp_stripped" > "$tmp_placed"

# Squash the double blank line an insert next to an existing blank produces.
awk 'BEGIN{prev=0} {if($0=="") {if(prev==0) print; prev=1} else {print; prev=0}}' \
  "$tmp_placed" > "$hook"

rm -f "$tmp_stripped" "$tmp_placed"
echo "  installed the axiom block after the shebang in .git/hooks/pre-commit"

rm -f "$root/.git/hooks/.axiom-block.tmp"
chmod +x "$hook"
sh -n "$hook" && echo "  hook syntax ok"
