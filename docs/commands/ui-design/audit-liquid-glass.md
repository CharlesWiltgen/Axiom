---
name: audit-liquid-glass
description: Automated scan for Liquid Glass adoption opportunities and migration from old blur effects
---

# Liquid Glass Audit

Scan your SwiftUI codebase for Liquid Glass adoption opportunities, toolbar improvements, and migration opportunities from older blur effects.

## What It Scans

### High Priority
- `UIBlurEffect`, `NSVisualEffectView`, and SwiftUI `Material` on surfaces that float over content
- An app-wide opt-out through `UIDesignRequiresCompatibility` while adoption work remains, since the key stops applying on iOS 27 once the app builds with the 27 SDK
- Regular glass over photos, video, or maps, where Clear belongs
- Glass nested inside glass

### Medium Priority
- Sheet and editor toolbars that place Save, Done, or Cancel by position instead of with `.confirmationAction` / `.cancellationAction`
- Custom floating views that could benefit from `.glassEffect()`
- Search outside the platform pattern: `.searchable()` not in NavigationSplitView, or a tab-based app without a `Tab(role: .search)` tab
- `if #available(iOS 26, *)` fallbacks that leave iOS 18 users with an unstyled surface

### Low Priority
- Prominent buttons whose meaning (such as a confirmation) needs a semantic tint rather than the default accent color
- Custom tappable glass without interactive glass (`.glassEffect(.regular.interactive())`)

## Usage

```bash
# Scan entire project
/axiom:audit liquid-glass

# Or use the general audit command
/axiom:audit
# Then select "liquid-glass" from suggestions
```

## Example Output

```
=== Liquid Glass Adoption Audit ===

HIGH Priority:
  src/Views/OverlayView.swift:67
    Current: .background(.ultraThinMaterial) on a floating overlay
    Recommendation: .glassEffect() for iOS 26+

MEDIUM Priority:
  src/Views/EditItemSheet.swift:41
    Current: Save placed with .topBarTrailing
    Recommendation: .confirmationAction, which gets prominent glass automatically

  src/Views/RootTabView.swift:12
    TabView has no search tab
    Recommendation: add Tab(role: .search)

Summary:
  - 6 migration opportunities (old blur effects)
  - 3 toolbar improvements
  - 2 search pattern updates
```

## Related

- [liquid-glass](/skills/ui-design/liquid-glass) – Implementation patterns and adoption guidance
- [swiftui-26-ref](/reference/swiftui-26-ref) – iOS 26 SwiftUI features including Liquid Glass APIs
- [liquid-glass-auditor](/agents/liquid-glass-auditor) – Automated agent for deeper analysis

## Requirements

- iOS 26+ for Liquid Glass features
- Xcode 26+ for latest SwiftUI APIs
