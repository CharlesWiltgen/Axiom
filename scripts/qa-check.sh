#!/bin/bash
# Axiom QA Check Script
# Validates plugin manifest, files, and documentation

echo "════════════════════════════════════════"
echo "  Axiom QA Check"
echo "════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# 1. JSON Validation
echo "📋 Validating JSON files..."
if node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugins/axiom/claude-code.json'))"; then
    echo -e "${GREEN}✓${NC} claude-code.json is valid JSON"
else
    echo -e "${RED}✗${NC} claude-code.json has JSON errors"
    ((ERRORS++))
fi

if node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json'))"; then
    echo -e "${GREEN}✓${NC} marketplace.json is valid JSON"
else
    echo -e "${RED}✗${NC} marketplace.json has JSON errors"
    ((ERRORS++))
fi
echo ""

# 2. Command Files Existence
echo "📁 Checking command files..."
MANIFEST_COMMANDS=$(node -e "
const manifest = require('./.claude-plugin/plugins/axiom/claude-code.json');
manifest.commands.forEach(cmd => console.log(cmd));
")

while IFS= read -r cmd; do
    FILE_PATH=".claude-plugin/plugins/axiom/$cmd"
    if [ -f "$FILE_PATH" ]; then
        echo -e "${GREEN}✓${NC} $cmd exists"
    else
        echo -e "${RED}✗${NC} $cmd missing"
        ((ERRORS++))
    fi
done <<< "$MANIFEST_COMMANDS"
echo ""

# 3. Agent Files Existence
echo "🤖 Checking agent files..."
AGENT_COUNT=0
for agent in .claude-plugin/plugins/axiom/agents/*.md; do
    if [ -f "$agent" ]; then
        ((AGENT_COUNT++))
    fi
done
echo -e "${GREEN}✓${NC} Found $AGENT_COUNT agent files"
echo ""

# 4. Skill Files Existence
echo "⚡ Checking skill files..."
SKILL_COUNT=0
for skill in .claude-plugin/plugins/axiom/skills/*/*.md; do
    if [ -f "$skill" ]; then
        ((SKILL_COUNT++))
    fi
done
echo -e "${GREEN}✓${NC} Found $SKILL_COUNT skill files"
echo ""

# 5. Version Consistency
echo "🔢 Checking version consistency..."
PLUGIN_VERSION=$(node -e "console.log(require('./.claude-plugin/plugins/axiom/claude-code.json').version)")
MARKETPLACE_VERSION=$(node -e "console.log(require('./.claude-plugin/marketplace.json').plugins[0].version)")
# VitePress version is in the footer copyright - extract from built site or config
VITEPRESS_VERSION=$(grep -o "v[0-9]\+\.[0-9]\+\.[0-9]\+" docs/.vitepress/config.ts | head -1 | sed 's/v//' || echo "$PLUGIN_VERSION")

echo "  Plugin:      $PLUGIN_VERSION"
echo "  Marketplace: $MARKETPLACE_VERSION"
echo "  VitePress:   $VITEPRESS_VERSION"

if [ "$PLUGIN_VERSION" = "$MARKETPLACE_VERSION" ] && [ "$PLUGIN_VERSION" = "$VITEPRESS_VERSION" ]; then
    echo -e "${GREEN}✓${NC} All versions match: $PLUGIN_VERSION"
else
    echo -e "${RED}✗${NC} Version mismatch detected"
    ((ERRORS++))
fi
echo ""

# 6. Frontmatter Validation (check for colons in headers)
echo "📝 Checking for colons in markdown headers..."
COLON_HEADERS=$(grep -rn "^##.*:$" .claude-plugin/plugins/axiom --include="*.md" 2>/dev/null || true)
if [ -z "$COLON_HEADERS" ]; then
    echo -e "${GREEN}✓${NC} No colons in markdown headers"
else
    echo -e "${YELLOW}⚠${NC} Found headers with colons (violates documentation-style.md):"
    echo "$COLON_HEADERS" | head -5
    ((WARNINGS++))
fi
echo ""

# 7. Check for Critical Rules sections (should be Audit Guidelines)
echo "📋 Checking for outdated 'Critical Rules' sections..."
CRITICAL_RULES=$(grep -rn "^## Critical Rules" .claude-plugin/plugins/axiom/agents --include="*.md" 2>/dev/null || true)
if [ -z "$CRITICAL_RULES" ]; then
    echo -e "${GREEN}✓${NC} All agents use 'Audit Guidelines'"
else
    echo -e "${YELLOW}⚠${NC} Found outdated 'Critical Rules' sections:"
    echo "$CRITICAL_RULES"
    ((WARNINGS++))
fi
echo ""

# 8. VitePress Build
echo "🏗️  Building VitePress docs..."
if npm run docs:build > /tmp/axiom-docs-build.log 2>&1; then
    echo -e "${GREEN}✓${NC} VitePress build successful"
else
    echo -e "${RED}✗${NC} VitePress build failed (see /tmp/axiom-docs-build.log)"
    ((ERRORS++))
fi
echo ""

# 9. Check for shell piping in agents (deprecated patterns)
echo "🔍 Checking for deprecated shell piping in agents..."
# Exclude documentation about what NOT to do (grep -v "Note:")
SHELL_PIPING=$(grep -rn "xargs\|sh -c" .claude-plugin/plugins/axiom/agents --include="*.md" 2>/dev/null | grep -v "Note: Cannot use" || true)
if [ -z "$SHELL_PIPING" ]; then
    echo -e "${GREEN}✓${NC} No deprecated shell piping found"
else
    echo -e "${YELLOW}⚠${NC} Found potential shell piping (may not work with Claude Code Grep):"
    echo "$SHELL_PIPING" | head -5
    ((WARNINGS++))
fi
echo ""

# 10. Check for WWDC session numbers in feature headers (exclude resource sections)
echo "📺 Checking for WWDC session numbers in feature headers..."
# Exclude legitimate resource sections like "## WWDC 2025 Sessions", "## WWDC 2025 References"
# Also exclude parenthetical WWDC references like "(WWDC 2025)"
WWDC_HEADERS=$(grep -rn "^##[^#].*WWDC.*[0-9]" docs --include="*.md" 2>/dev/null | grep -v "WWDC.*Sessions\|WWDC.*References\|WWDC.*)" || true)
if [ -z "$WWDC_HEADERS" ]; then
    echo -e "${GREEN}✓${NC} No WWDC session numbers in feature headers (resource sections excluded)"
else
    echo -e "${YELLOW}⚠${NC} Found WWDC session numbers in feature headers (should be in resource sections only):"
    echo "$WWDC_HEADERS" | head -5
    echo -e "${YELLOW}   Tip: Move WWDC numbers to resource sections or use parenthetical format${NC}"
    ((WARNINGS++))
fi
echo ""

# Summary
echo "════════════════════════════════════════"
echo "  QA Summary"
echo "════════════════════════════════════════"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s), $WARNINGS warning(s) found${NC}"
    exit 1
fi
