# Accessibility Debugging

Comprehensive accessibility diagnostics with WCAG compliance, Accessibility Inspector workflows, and App Store Review preparation.

## When to Use

- Fixing VoiceOver navigation issues (missing labels, wrong element order)
- Supporting Dynamic Type (text scaling for vision disabilities)
- Meeting color contrast requirements (WCAG AA/AAA)
- Fixing touch target size violations (< 44x44pt)
- Adding keyboard navigation (iPadOS/macOS)
- Supporting Reduce Motion (vestibular disorders)
- Preparing for App Store Review accessibility requirements
- Responding to user complaints about accessibility

## What It Covers

### 1. VoiceOver Labels & Hints (CRITICAL)
Missing or generic accessibility labels prevent VoiceOver users from understanding UI purpose.

**WCAG** 4.1.2 Name, Role, Value (Level A)

### 2. Dynamic Type Support (HIGH)
Fixed font sizes prevent users with vision disabilities from reading text.

**WCAG** 1.4.4 Resize Text (Level AA)

### 3. Color Contrast (HIGH)
Low contrast text is unreadable for users with vision disabilities or in bright sunlight.

**WCAG** 1.4.3 Contrast (Minimum) — Level AA
- Normal text: 4.5:1 contrast ratio
- Large text: 3:1 contrast ratio

### 4. Touch Target Sizes (MEDIUM)
Small tap targets are difficult or impossible for users with motor disabilities.

**WCAG** 2.5.5 Target Size (Level AAA) — 44x44pt minimum

### 5. Keyboard Navigation (MEDIUM)
Users who cannot use touch/mouse cannot navigate app.

**WCAG** 2.1.1 Keyboard (Level A)

### 6. Reduce Motion Support (MEDIUM)
Animations cause discomfort, nausea, or seizures for users with vestibular disorders.

**WCAG** 2.3.3 Animation from Interactions (Level AAA)

### 7. Common Violations (HIGH)
- Images without labels
- Buttons with wrong accessibility traits
- Inaccessible custom controls
- Missing state announcements

## Key Features

- **7 Critical Issue Categories** — Covers 95% of App Store accessibility rejections
- **WCAG Compliance Levels** — Level A (required), AA (standard), AAA (enhanced)
- **Accessibility Inspector Workflows** — Step-by-step tool usage
- **VoiceOver Testing Checklist** — Complete testing protocol
- **App Store Review Preparation** — What reviewers check
- **Code Examples** — Wrong vs. correct patterns for every issue
- **Testing Protocols** — How to verify fixes work

## Testing Tools

### Accessibility Inspector
Xcode → Open Developer Tool → Accessibility Inspector
- Inspection mode for element details
- Automated audit for common issues
- Runtime validation

### VoiceOver Testing
- Simulator: Cmd+F5
- Device: Triple-click side button
- Navigate with swipe gestures
- Verify announcements

### Dynamic Type Testing
Settings → Accessibility → Display & Text Size → Larger Text
- Test at maximum size
- Verify layout adapts
- Check for text clipping

## WCAG Compliance Reference

### Level A (Minimum — Required)
- 1.1.1 Non-text Content
- 2.1.1 Keyboard
- 4.1.2 Name, Role, Value

### Level AA (Standard — Recommended)
- 1.4.3 Contrast (Minimum)
- 1.4.4 Resize Text
- 1.4.5 Images of Text

### Level AAA (Enhanced — Best Practice)
- 1.4.6 Contrast (Enhanced)
- 2.3.3 Animation from Interactions
- 2.5.5 Target Size

## Example Workflows

### Fixing Missing VoiceOver Labels
1. Run `/axiom:audit-accessibility` to find unlabeled elements
2. Add `.accessibilityLabel("descriptive text")` to each
3. Test with VoiceOver (Cmd+F5)
4. Verify announcements are clear and helpful

### Supporting Dynamic Type
1. Replace fixed fonts with semantic styles (`.body`, `.headline`)
2. Test at Settings → Larger Text → Maximum
3. Verify text remains readable and layout adapts
4. Use `.dynamicTypeSize()` to limit if needed

### Meeting Color Contrast
1. Use Color Contrast Analyzer tool
2. Measure text vs background ratios
3. Adjust colors to meet 4.5:1 minimum
4. Test in both light and dark mode
5. Add differentiation beyond color if needed

## Quick Reference

```swift
// VoiceOver Labels
.accessibilityLabel("Add to cart")
.accessibilityHint("Double-tap to add item")

// Dynamic Type
.font(.body) // Instead of .font(.system(size: 17))

// Color Contrast
.foregroundColor(.primary) // Auto light/dark

// Touch Targets
.frame(minWidth: 44, minHeight: 44)

// Reduce Motion
if !UIAccessibility.isReduceMotionEnabled {
  withAnimation { }
}
```

## See Also

- **[/audit-accessibility Command](/commands/accessibility/audit-accessibility)** — Quick automated scan
- **[Apple Accessibility Guidelines](https://developer.apple.com/design/human-interface-guidelines/accessibility)**
- **[WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)**
