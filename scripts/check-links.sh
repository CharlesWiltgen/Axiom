#!/bin/bash
# Check for broken internal links in documentation

set -e

echo "════════════════════════════════════════"
echo "  Broken Link Checker"
echo "════════════════════════════════════════"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BROKEN_LINKS=0
CHECKED_LINKS=0

# Function to check if a file exists
check_link() {
    local source_file="$1"
    local link_path="$2"
    local link_line="$3"

    # Skip external links (http://, https://)
    if [[ "$link_path" =~ ^https?:// ]]; then
        return 0
    fi

    # Skip anchor-only links (#section)
    if [[ "$link_path" =~ ^# ]]; then
        return 0
    fi

    # Skip mailto: links
    if [[ "$link_path" =~ ^mailto: ]]; then
        return 0
    fi

    # Get directory of source file
    local source_dir=$(dirname "$source_file")

    # Resolve the link path
    local full_path
    if [[ "$link_path" =~ ^/ ]]; then
        # Absolute path from docs root (e.g., /guide/quick-start)
        # Remove leading /Axiom/ if present (VitePress base path)
        link_path="${link_path#/Axiom}"
        full_path="docs${link_path}"
    else
        # Relative path
        full_path="${source_dir}/${link_path}"
    fi

    # Remove anchor fragments
    full_path="${full_path%%#*}"

    # Add .md if no extension and not ending in /
    if [[ ! "$full_path" =~ \.[a-z]+$ ]] && [[ ! "$full_path" =~ /$ ]]; then
        # Check both with .md and as directory with index.md
        if [ -f "${full_path}.md" ]; then
            full_path="${full_path}.md"
        elif [ -f "${full_path}/index.md" ]; then
            full_path="${full_path}/index.md"
        else
            full_path="${full_path}.md"
        fi
    elif [[ "$full_path" =~ /$ ]]; then
        # Trailing slash implies index.md
        full_path="${full_path}index.md"
    fi

    # Normalize path (remove .., ./)
    full_path=$(cd "$(dirname "$full_path")" 2>/dev/null && echo "$(pwd)/$(basename "$full_path")" || echo "$full_path")

    ((CHECKED_LINKS++))

    # Check if file exists
    if [ ! -f "$full_path" ]; then
        echo -e "${RED}✗${NC} Broken link in ${source_file}:${link_line}"
        echo "   Link: ${link_path}"
        echo "   Expected: ${full_path}"
        ((BROKEN_LINKS++))
        return 1
    fi

    return 0
}

echo "📋 Scanning documentation files..."

# Find all markdown files and extract links
while IFS= read -r file; do
    # Extract markdown links: [text](path)
    # Use perl for better regex support
    perl -ne 'print "$1\n" if /\[.*?\]\((.*?)\)/' "$file" | while IFS= read -r link; do
        # Get line number for this link
        line_num=$(grep -n "](${link})" "$file" 2>/dev/null | head -1 | cut -d: -f1)

        if [ -n "$link" ]; then
            check_link "$file" "$link" "${line_num:-0}" || true
        fi
    done
done < <(find docs .claude-plugin/plugins/axiom -name "*.md" -type f)

echo ""
echo "════════════════════════════════════════"
echo "  Link Check Summary"
echo "════════════════════════════════════════"

if [ $BROKEN_LINKS -eq 0 ]; then
    echo -e "${GREEN}✓ All $CHECKED_LINKS links are valid!${NC}"
    exit 0
else
    echo -e "${RED}✗ Found $BROKEN_LINKS broken link(s) out of $CHECKED_LINKS checked${NC}"
    exit 1
fi
