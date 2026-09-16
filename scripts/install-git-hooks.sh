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

# Strip any block a previous run installed — the markers AND the one blank line
# that follows them — then insert the current one after the shebang. Unconditional,
# and in that order, because a block that is already there may be in the wrong
# place: the first revision appended, so an installed block can sit after another
# tool's `exit` and never run. Replacing it in place would preserve that position.
#
# Consuming the trailing blank is what makes a re-install byte-identical. Without
# it the block's own separator survives the strip and joins the separator the
# insert adds, so the file grows by a line on every run.
tmp_stripped="$root/.git/hooks/.pre-commit.stripped"

awk -v begin="$BEGIN" -v end="$END" '
  # Compare with any trailing CR removed. A hook written with CRLF endings would
  # otherwise never match its own markers: the strip would find nothing, the insert
  # would add a SECOND block, and every commit would then run the content scan
  # twice while the installer reported success.
  { line = $0; sub(/\r$/, "", line) }
  line == begin { skip = 1; next }
  skip && line == end { skip = 0; drop_blank = 1; next }
  skip { next }
  {
    if (drop_blank) { drop_blank = 0; if (line == "") next }
    print
  }
' "$hook" > "$tmp_stripped"

# Insert right after the shebang — NOT at the end. An existing hook file may
# already carry another tool's block, and a block that terminates the script
# (an `exit`, an `exec`) would leave this one unreachable while the installer
# still reported success. The sibling installer
# (.claude/scripts/install-leak-prevention-hooks.sh) prepends for this reason,
# and this repo's own .git/hooks/pre-commit is exactly that case: the beads
# block carries `if [ $_bd_exit -ne 0 ]; then exit $_bd_exit; fi`.
#
# No blank BEFORE the block; one after it. The strip above removes that same
# blank, so the pair is a fixed point.
awk -v block="$root/.git/hooks/.axiom-block.tmp" '
  BEGIN {
    while ((getline line < block) > 0) body = body line "\n"
    placed = 0
  }
  !placed && NR == 1 && /^#!/ { print; printf "%s\n", body; placed = 1; next }
  !placed { printf "%s\n", body; placed = 1 }
  { print }
  END { if (!placed) printf "%s", body }
' "$tmp_stripped" > "$hook"

rm -f "$tmp_stripped"
echo "  installed the axiom block after the shebang in .git/hooks/pre-commit"

rm -f "$root/.git/hooks/.axiom-block.tmp"
chmod +x "$hook"
sh -n "$hook" && echo "  hook syntax ok"
