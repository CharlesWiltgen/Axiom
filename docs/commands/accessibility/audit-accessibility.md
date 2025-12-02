---
name: audit-accessibility
description: Comprehensive accessibility audit — detects VoiceOver label issues, Dynamic Type violations, color contrast failures, touch target size problems, keyboard navigation gaps, and Reduce Motion support with file:line references and WCAG compliance ratings
allowed-tools: Glob(*.swift), Grep(*)
---

# Accessibility Audit

I'll perform a comprehensive accessibility audit of your iOS/macOS codebase, checking for the most critical issues that affect users with disabilities and cause App Store rejections.

## What I'll Check

### 1. VoiceOver Labels & Hints (CRITICAL)
**Pattern**: Missing `accessibilityLabel`, generic labels ("Button"), missing `accessibilityHint`
**Impact**: Users with vision disabilities cannot understand UI purpose
**WCAG**: 4.1.2 Name, Role, Value (Level A)

### 2. Dynamic Type Support (HIGH)
**Pattern**: Fixed font sizes, hardcoded `UIFont.systemFont(ofSize:)`, missing `.font(.body)` in SwiftUI
**Impact**: Users with vision disabilities cannot read text
**WCAG**: 1.4.4 Resize Text (Level AA)

### 3. Color Contrast (HIGH)
**Pattern**: Low contrast text/background combinations, missing `.accessibilityDifferentiateWithoutColor`
**Impact**: Users with vision disabilities cannot read content
**WCAG**: 1.4.3 Contrast (Minimum) (Level AA - 4.5:1 for text, 3:1 for large text)

### 4. Touch Target Sizes (MEDIUM)
**Pattern**: Buttons/tappable areas smaller than 44x44pt
**Impact**: Users with motor disabilities cannot tap accurately
**WCAG**: 2.5.5 Target Size (Level AAA - 44x44pt)

### 5. Keyboard Navigation (iPadOS/macOS) (MEDIUM)
**Pattern**: Missing keyboard shortcuts, non-focusable interactive elements
**Impact**: Users who cannot use touch/mouse cannot navigate
**WCAG**: 2.1.1 Keyboard (Level A)

### 6. Reduce Motion Support (MEDIUM)
**Pattern**: Animations without `UIAccessibility.isReduceMotionEnabled` checks
**Impact**: Users with vestibular disorders experience discomfort/nausea
**WCAG**: 2.3.3 Animation from Interactions (Level AAA)

### 7. Common Violations (HIGH)
**Pattern**: Images without labels, buttons with wrong traits, inaccessible custom controls
**Impact**: VoiceOver users cannot understand or interact with UI
**WCAG**: Multiple (1.1.1 Non-text Content, 4.1.2 Name Role Value)

## Audit Process

1. **Glob** for all Swift files: `**/*.swift`
2. **Search** for accessibility anti-patterns using regex
3. **Report** findings with:
   - `file:line` references
   - Severity: CRITICAL/HIGH/MEDIUM/LOW
   - WCAG guideline reference
   - Fix recommendation
   - Link to `axiom:accessibility-debugging` skill for detailed remediation

## Output Format

```
=== ACCESSIBILITY AUDIT RESULTS ===

CRITICAL Issues (App Store Rejection Risk):
- src/Views/ProductCard.swift:42 - Missing accessibilityLabel on Button
  WCAG 4.1.2 (Level A)
  Fix: Add .accessibilityLabel("Add to cart")

HIGH Issues (Major Usability Impact):
- src/Views/PriceLabel.swift:18 - Fixed font size (17pt)
  WCAG 1.4.4 (Level AA)
  Fix: Use .font(.body) or UIFontMetrics.default.scaledFont(for:)

MEDIUM Issues (Moderate Usability Impact):
- src/Views/CloseButton.swift:25 - Touch target 32x32pt (should be 44x44pt)
  WCAG 2.5.5 (Level AAA)
  Fix: Increase frame to 44x44pt or add .frame(minWidth: 44, minHeight: 44)

=== NEXT STEPS ===

For detailed remediation guidance, use:
  /skill axiom:accessibility-debugging

WCAG Compliance Level:
- Level A: ❌ (4 violations)
- Level AA: ❌ (2 violations)
- Level AAA: ⚠️ (1 violation)
```

## Detection Patterns

### VoiceOver Labels
```swift
// BAD - No label
Button(action: {}) {
  Image(systemName: "plus")
}

// BAD - Generic label
.accessibilityLabel("Button")

// GOOD
.accessibilityLabel("Add item to cart")
```

### Dynamic Type
```swift
// BAD - Fixed size
.font(.system(size: 17))
UIFont.systemFont(ofSize: 17)

// GOOD
.font(.body)
UIFont.preferredFont(forTextStyle: .body)
UIFontMetrics.default.scaledFont(for: customFont)
```

### Color Contrast
```swift
// BAD - Low contrast
Text("Warning").foregroundColor(.yellow) // on white background

// GOOD - High contrast or differentiator
Text("Warning")
  .foregroundColor(.orange) // 4.5:1+ contrast
  .accessibilityShowsLargeContentViewer() // fallback
```

### Touch Targets
```swift
// BAD - Too small
Button("X") {}.frame(width: 24, height: 24)

// GOOD - 44x44pt minimum
Button("X") {}.frame(minWidth: 44, minHeight: 44)
```

### Reduce Motion
```swift
// BAD - Always animates
withAnimation(.spring()) { }

// GOOD - Respects preference
if !UIAccessibility.isReduceMotionEnabled {
  withAnimation(.spring()) { }
}
```

## Search Queries I'll Run

1. **Missing Labels**: `Grep "Image\(|Button\(|Link\(" -A 5` (check for missing `.accessibilityLabel`)
2. **Fixed Fonts**: `Grep "\.font\(\.system\(size:|UIFont\.systemFont\(ofSize:"`
3. **Generic Labels**: `Grep "accessibilityLabel\(\"(Button|Image|Icon|View)\"\)"`
4. **Small Targets**: `Grep "\.frame\((width|height):\s*([0-9]|[1-3][0-9])\)"` (< 44pt)
5. **Missing Motion Check**: `Grep "withAnimation|\.animation\(" -B 5` (no `isReduceMotionEnabled` check)
6. **Images Without Labels**: `Grep "Image\(" -A 3` (check for `.accessibilityLabel` or `.accessibilityHidden(true)`)

## Limitations

- **Cannot detect**: Runtime contrast issues, actual rendered sizes, VoiceOver navigation order
- **False positives**: Decorative images (should be `.accessibilityHidden(true)`), spacer views
- **Use Accessibility Inspector** for runtime validation after fixes

## Post-Audit

After fixing issues:
1. Run Accessibility Inspector (Xcode → Open Developer Tool)
2. Test with VoiceOver (Cmd+F5 on simulator)
3. Test with Dynamic Type (Settings → Accessibility → Display & Text Size)
4. Test with Reduce Motion (Settings → Accessibility → Motion → Reduce Motion)

For comprehensive debugging: `/skill axiom:accessibility-debugging`
