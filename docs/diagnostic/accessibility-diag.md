---
name: accessibility-diag
description: VoiceOver, Dynamic Type, color contrast, touch targets — WCAG compliance with App Store rejection defense
---

# Accessibility Diagnostics

Systematic accessibility troubleshooting with App Store rejection defense and design review push-back frameworks.

## Overview

Diagnostic workflows for VoiceOver testing, Dynamic Type support, color contrast validation, and touch target compliance. Includes mandatory steps for App Store review preparation and handling accessibility-related rejections.

## What This Diagnostic Covers

### Mandatory Accessibility Checks

#### VoiceOver Testing
- Missing accessibility labels
- Poor label quality (technical vs user-friendly)
- Button vs image traits
- Custom control announcements
- Navigation order

#### Dynamic Type Support
- Fixed font sizes blocking text scaling
- Layout breaking at larger sizes
- Missing `.minimumScaleFactor`
- Text truncation issues
- Horizontal scrolling required

#### Color Contrast
- WCAG AA compliance (4.5:1 for text)
- WCAG AAA targets (7:1 for text)
- Insufficient contrast in dark mode
- Rely on color alone for information

#### Touch Targets
- Minimum 44×44pt hit areas (Apple HIG)
- WCAG 2.5.5 Target Size (24×24pt minimum)
- Spacing between tappable elements
- Gesture conflicts

### App Store Rejection Defense

#### Guideline 2.5.2 - Accessibility

Common rejection scenarios:
- "App is not accessible to users with disabilities"
- "VoiceOver cannot access key features"
- "Text does not scale with Dynamic Type"
- "Insufficient color contrast in UI"

#### 48-Hour Resubmit Pressure
- Systematic issue identification
- Priority triage (blockers vs enhancements)
- Compliance verification workflow
- Resubmission checklist

## When to Use This Diagnostic

Use this diagnostic when:
- App Store rejected for accessibility (Guideline 2.5.2)
- Preparing for App Store submission
- Accessibility audit requested by legal/compliance
- Users report VoiceOver issues
- Adding new UI components or screens
- Before major releases

## Diagnostic Workflow

```
1. VoiceOver Sweep (30-60 min)
   ├─ Close eyes, navigate entire app
   ├─ Document unintelligible or missing labels
   ├─ Test all interactive elements
   └─ Verify forms and error states

2. Dynamic Type Test (15-30 min)
   ├─ Settings → Accessibility → Larger Text
   ├─ Max size (AX5 / 310%)
   ├─ Navigate all screens
   └─ Document truncation and breaking layouts

3. Color Contrast Scan (15-30 min)
   ├─ Use Accessibility Inspector
   ├─ Check all text against backgrounds
   ├─ Test in light mode and dark mode
   └─ Verify WCAG AA compliance (4.5:1)

4. Touch Target Validation (15-30 min)
   ├─ Measure all interactive elements
   ├─ Verify 44×44pt minimum
   ├─ Check spacing between targets
   └─ Test with large hands on smallest device
```

## Design Review Push-Back

**Scenario**: Designer insists on 12pt font that breaks Dynamic Type

**Framework**:
1. **Cite Apple HIG**: "All text must support Dynamic Type"
2. **Show compliance**: "App Store Review Guideline 2.5.2"
3. **Demonstrate issue**: Record VoiceOver navigation breaking
4. **Offer alternatives**: Suggest scalable alternatives
5. **Escalate if needed**: "This is a rejection risk"

**Scenario**: Design requires color-only information (red/green status)

**Framework**:
1. **Cite WCAG**: "Success Criterion 1.4.1 - Use of Color"
2. **Show impact**: "8% of males are colorblind"
3. **Demonstrate issue**: Screenshot in grayscale
4. **Offer alternatives**: Icons, text labels, patterns
5. **Document risk**: "Potential rejection under 2.5.2"

## Tools and Resources

### Xcode Accessibility Inspector
- VoiceOver preview
- Contrast ratio calculator
- Audit scans
- Element hierarchy

### System Settings
- VoiceOver (Settings → Accessibility → VoiceOver)
- Display & Text Size (larger text, bold text)
- Reduce Motion
- Increase Contrast

### Third-Party Tools
- Sim Daltonism (colorblindness simulator)
- Contrast (contrast checker app)
- WAVE (web accessibility checker)

## Related Resources

- [audit-accessibility](/commands/accessibility/audit-accessibility) — Quick automated scan
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Apple HIG - Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

## Documentation Scope

This is a **diagnostic skill** — mandatory workflows with pressure defense scenarios.

#### Diagnostic includes
- Step-by-step troubleshooting
- App Store rejection defense
- Design review push-back frameworks
- Compliance verification checklists
- Production crisis scenarios

**Vs Reference**: Diagnostic skills enforce specific workflows and handle pressure scenarios. Reference skills provide comprehensive information without mandatory steps.

## Size

19 KB - Diagnostic workflows with rejection defense
