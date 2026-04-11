#!/bin/bash
# Migrate all skill names to use axiom- prefix
# Usage: ./scripts/migrate-skill-namespace.sh

set -e

cd /Users/Charles/Projects/Axiom

SKILLS_DIR=".claude-plugin/plugins/axiom/skills"
AGENTS_DIR=".claude-plugin/plugins/axiom/agents"
COMMANDS_DIR=".claude-plugin/plugins/axiom/commands"
DOCS_DIR="docs"
MANIFEST=".claude-plugin/plugins/axiom/claude-code.json"

echo "=== Axiom Namespace Migration ==="
echo ""

# Step 1: Get list of all current skill directory names
echo "Step 1: Building skill name list..."
SKILL_NAMES=$(ls -d $SKILLS_DIR/*/ 2>/dev/null | xargs -n1 basename | grep -v '^axiom-' | sort)
SKILL_COUNT=$(echo "$SKILL_NAMES" | wc -l | tr -d ' ')
echo "Found $SKILL_COUNT skills to migrate"

# Save skill names to temp file for reference
echo "$SKILL_NAMES" > /tmp/axiom-skill-names.txt
echo ""

# Step 2: Rename directories
echo "Step 2: Renaming skill directories..."
for skill in $SKILL_NAMES; do
  if [ -d "$SKILLS_DIR/$skill" ]; then
    new_name="axiom-$skill"
    if [ ! -d "$SKILLS_DIR/$new_name" ]; then
      mv "$SKILLS_DIR/$skill" "$SKILLS_DIR/$new_name"
      echo "  $skill → $new_name"
    fi
  fi
done
echo ""

# Step 3: Update frontmatter name: fields
echo "Step 3: Updating frontmatter..."
for skill in $SKILL_NAMES; do
  # Find files that might have this skill name in frontmatter
  find $SKILLS_DIR -name "*.md" -exec grep -l "^name: $skill\$" {} \; 2>/dev/null | while read file; do
    sed -i '' "s/^name: $skill\$/name: axiom-$skill/" "$file"
    echo "  Updated frontmatter: $file"
  done
done
echo ""

# Step 4: Update /skill references
echo "Step 4: Updating /skill references..."
for skill in $SKILL_NAMES; do
  # Update /skill skillname → /skill axiom-skillname
  find $SKILLS_DIR $AGENTS_DIR $COMMANDS_DIR -name "*.md" -exec sed -i '' "s|/skill $skill|/skill axiom-$skill|g" {} \;
done
echo "  Updated /skill references in plugin files"
echo ""

# Step 5: Update Related Skills sections and backtick references
echo "Step 5: Updating skill cross-references..."
for skill in $SKILL_NAMES; do
  # Update backtick references like `swift-concurrency`
  # Be specific: only match exact skill names
  find $SKILLS_DIR -name "*.md" -exec sed -i '' "s|\`$skill\`|\`axiom-$skill\`|g" {} \;
  # Update Skills: lists (e.g., "Skills: swift-concurrency, memory-debugging")
  find $SKILLS_DIR -name "*.md" -exec sed -i '' "s|Skills: $skill|Skills: axiom-$skill|g" {} \;
  find $SKILLS_DIR -name "*.md" -exec sed -i '' "s|, $skill|, axiom-$skill|g" {} \;
done
echo "  Updated skill cross-references"
echo ""

# Step 6: Update manifest skill names
echo "Step 6: Updating manifest..."
for skill in $SKILL_NAMES; do
  sed -i '' "s|\"name\": \"$skill\"|\"name\": \"axiom-$skill\"|g" "$MANIFEST"
done
echo "  Updated $MANIFEST"
echo ""

# Step 7: Update documentation
echo "Step 7: Updating documentation..."
for skill in $SKILL_NAMES; do
  # Update backtick references in docs
  find $DOCS_DIR -name "*.md" -exec sed -i '' "s|\`$skill\`|\`axiom-$skill\`|g" {} \; 2>/dev/null || true
  # Update links like [skill-name](/skills/path/skill-name)
  find $DOCS_DIR -name "*.md" -exec sed -i '' "s|/$skill)|/axiom-$skill)|g" {} \; 2>/dev/null || true
  find $DOCS_DIR -name "*.md" -exec sed -i '' "s|/$skill.md|/axiom-$skill.md|g" {} \; 2>/dev/null || true
done
echo "  Updated documentation"
echo ""

# Step 8: Fix any accidental double-prefixes
echo "Step 8: Fixing double-prefixes..."
find $SKILLS_DIR $AGENTS_DIR $COMMANDS_DIR $DOCS_DIR -name "*.md" -exec sed -i '' 's|axiom-axiom-|axiom-|g' {} \; 2>/dev/null || true
sed -i '' 's|axiom-axiom-|axiom-|g' "$MANIFEST"
echo "  Fixed double-prefixes"
echo ""

echo "=== Migration Complete ==="
echo ""
echo "Migrated $SKILL_COUNT skills"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff --stat"
echo "2. Spot check: git diff .claude-plugin/plugins/axiom/skills/axiom-concurrency/"
echo "3. Test plugin: claude-code plugin reload axiom"
echo "4. Verify display: Ask Claude to help with iOS concurrency"
