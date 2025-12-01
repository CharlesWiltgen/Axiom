# /audit-accessibility

Comprehensive accessibility audit detecting VoiceOver issues, Dynamic Type violations, color contrast failures, and WCAG compliance problems.

## Purpose

Performs a **comprehensive automated scan** (60-90 seconds) to identify accessibility issues that affect users with disabilities and cause App Store rejections.

**Command Type:** `/audit-*` (comprehensive analysis, 60-90 seconds)

## What It Checks

### 1. VoiceOver Labels & Hints (CRITICAL)
- Missing `accessibilityLabel` on images, buttons, and custom controls
- Generic labels ("Button", "Image") that don't describe purpose
- Missing `accessibilityHint` for complex interactions
- **WCAG:** 4.1.2 Name, Role, Value (Level A)

### 2. Dynamic Type Support (HIGH)
- Fixed font sizes (`UIFont.systemFont(ofSize:)`)
- Hardcoded `.font(.system(size:))` in SwiftUI
- Missing font scaling with `UIFontMetrics`
- **WCAG:** 1.4.4 Resize Text (Level AA)

### 3. Color Contrast (HIGH)
- Low contrast text/background combinations
- Missing color differentiation alternatives
- **WCAG:** 1.4.3 Contrast (Minimum) - 4.5:1 for text, 3:1 for large text (Level AA)

### 4. Touch Target Sizes (MEDIUM)
- Buttons/tappable elements smaller than 44x44pt
- Inadequate spacing between interactive elements
- **WCAG:** 2.5.5 Target Size (Level AAA)

### 5. Keyboard Navigation (MEDIUM - iPadOS/macOS)
- Missing keyboard shortcuts
- Non-focusable interactive elements
- **WCAG:** 2.1.1 Keyboard (Level A)

### 6. Reduce Motion Support (MEDIUM)
- Animations without `UIAccessibility.isReduceMotionEnabled` checks
- **WCAG:** 2.3.3 Animation from Interactions (Level AAA)

### 7. Common Violations (HIGH)
- Images without labels
- Buttons with wrong accessibility traits
- Inaccessible custom controls

## Example Output

\`\`\`
=== ACCESSIBILITY AUDIT RESULTS ===

CRITICAL Issues (App Store Rejection Risk): 3
- src/Views/ProductCard.swift:42 - Missing accessibilityLabel on Button
  WCAG 4.1.2 (Level A)
  Fix: Add .accessibilityLabel("Add to cart")

HIGH Issues (Major Usability Impact): 2
- src/Views/PriceLabel.swift:18 - Fixed font size (17pt)
  WCAG 1.4.4 (Level AA)
  Fix: Use .font(.body) or UIFontMetrics.default.scaledFont(for:)

MEDIUM Issues (Moderate Usability Impact): 1
- src/Views/CloseButton.swift:25 - Touch target 32x32pt (should be 44x44pt)
  WCAG 2.5.5 (Level AAA)
  Fix: Increase to .frame(minWidth: 44, minHeight: 44)

=== WCAG COMPLIANCE ===
Level A: ❌ (4 violations)
Level AA: ❌ (2 violations)
Level AAA: ⚠️ (1 violation)

=== NEXT STEPS ===
For detailed remediation: /skill axiom:accessibility-debugging
\`\`\`

## When to Use

- **Before App Store submission** - Catch rejections early
- **After UI changes** - Verify accessibility wasn't broken
- **Onboarding new developers** - Educate team on accessibility
- **Regular audits** - Maintain accessibility as feature

## Workflow

1. **Run audit**: `/axiom:audit-accessibility`
2. **Review findings**: Check CRITICAL issues first
3. **Fix violations**: Apply recommended fixes
4. **Deep diagnosis**: Use `/skill axiom:accessibility-debugging` for complex issues
5. **Test with tools**:
   - Accessibility Inspector (Xcode)
   - VoiceOver (Cmd+F5 on simulator)
   - Dynamic Type settings
6. **Re-audit**: Verify fixes resolved issues

## Limitations

**Cannot detect:**
- Runtime-only issues (navigation order, actual rendered contrast)
- Complex gesture accessibility
- Screen reader context changes

**False positives:**
- Decorative images (should use `.accessibilityHidden(true)`)
- Intentional spacer views

**For runtime validation:** Use Accessibility Inspector and VoiceOver testing after fixes.

## See Also

- **[Accessibility Debugging Skill](/skills/debugging/accessibility-debugging)** - Comprehensive diagnostics and remediation
- **[Apple Accessibility Guidelines](https://developer.apple.com/design/human-interface-guidelines/accessibility)** - Official guidance
- **[WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)** - Standards reference
