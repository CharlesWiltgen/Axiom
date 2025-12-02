# /audit-liquid-glass

Quick automated scan for Liquid Glass adoption opportunities in SwiftUI codebase - identifies views that could benefit from glass effects, toolbar improvements, search patterns, and migration opportunities.

## Purpose

Performs a **quick automated scan** (30-60 seconds) to identify Liquid Glass adoption opportunities and potential improvements in your iOS 26+ SwiftUI codebase.

**Command Type:** `/audit-*` (comprehensive analysis, 30-60 seconds)

## What It Checks

### 1. Custom Views for Glass Background Effect (MEDIUM)
- Custom view types that could benefit from `.glassBackgroundEffect()`
- Galleries, overlays, cards, and containers
- Views that would benefit from reflecting surrounding content

### 2. Toolbar Button Improvements (MEDIUM)
- Toolbars missing `Spacer(.fixed)` for button grouping
- Primary action buttons missing `.buttonStyle(.borderedProminent)`
- Prominent buttons missing `.tint()` for color

### 3. Search Pattern Opportunities (MEDIUM)
- `.searchable()` not in `NavigationSplitView` (won't get automatic bottom-alignment)
- `TabView` with search-related tabs missing `.tabRole(.search)`

### 4. Migration from Old Blur Effects (HIGH)
- `UIBlurEffect` usage (UIKit)
- `NSVisualEffectView` usage (AppKit)
- `.blur()` modifier on backgrounds
- `Material` usage that could migrate to Liquid Glass

### 5. Tinting Opportunities (MEDIUM)
- `.borderedProminent` buttons without `.tint()`
- Toolbar buttons that could be more prominent

## Example Output

```
=== LIQUID GLASS AUDIT RESULTS ===

HIGH PRIORITY (Migration Opportunities): 6
- src/Views/MainView.swift:67 - Old blur effect detected
  Current: .background(.ultraThinMaterial)
  Recommendation: .glassEffect() // iOS 26+ Liquid Glass

- src/Views/PhotoGallery.swift:89 - UIBlurEffect usage
  Current: UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
  Recommendation: Migrate to .glassBackgroundEffect()

MEDIUM PRIORITY (Toolbar & Search): 5
- src/Views/ToolbarView.swift:23 - Missing button grouping
  Current: 3 toolbar buttons without spacing
  Recommendation: Add Spacer(.fixed) to separate button groups

- src/Views/SearchView.swift:45 - Search not bottom-aligned
  Current: List with .searchable()
  Recommendation: Move to NavigationSplitView for bottom-alignment

MEDIUM PRIORITY (Custom Views): 12
- src/Views/PhotoCard.swift:34 - Custom view without glass effect
  Recommendation: Consider .glassBackgroundEffect() for photo gallery

=== SUMMARY ===
Total Opportunities: 23
- 6 migration opportunities (high priority)
- 5 toolbar/search improvements (medium priority)
- 12 custom view enhancements (medium priority)

=== NEXT STEPS ===
For implementation details: /skill axiom:liquid-glass
For all iOS 26 features: /skill axiom:swiftui-26-features
```

## When to Use

- **iOS 26+ migration** - Updating codebase for new Liquid Glass design system
- **After UI refactoring** - Check for adoption opportunities
- **Before design review** - Identify material consistency issues
- **Modernization projects** - Migrate from old blur effects

## Workflow

1. **Run audit**: `/audit-liquid-glass`
2. **Review findings**: Prioritize HIGH (migration) first
3. **Implement changes**:
   - Use `/skill axiom:liquid-glass` for detailed implementation
   - Use `/skill axiom:swiftui-26-features` for broader iOS 26 context
4. **Test on device**: Verify visual appearance on iOS 26+ devices
5. **Re-audit**: Confirm opportunities addressed

## Scan Categories Detail

### Custom Views for Glass Background Effect
**Pattern detected:**
```swift
struct PhotoGalleryView: View { }
struct OverlayCard: View { }
```

**Recommendation:**
```swift
.glassBackgroundEffect() // Reflects surrounding content
```

### Toolbar Improvements
**Pattern detected:**
```swift
.toolbar {
    Button("Up") { }
    Button("Down") { }
    Button("Settings") { }  // Could use Spacer(.fixed) before this
}
```

**Recommendation:**
```swift
.toolbar {
    ToolbarItemGroup(placement: .topBarTrailing) {
        Button("Up") { }
        Button("Down") { }

        Spacer(.fixed) // Separate navigation from settings

        Button("Settings") { }
    }
}
```

### Search Patterns
**Pattern detected:**
```swift
List { }
    .searchable(text: $query) // Won't get platform-specific placement
```

**Recommendation:**
```swift
NavigationSplitView {
    List { }
        .searchable(text: $query) // ✅ Gets bottom-alignment automatically
}
```

### Migration from Old Blur Effects
**Pattern detected:**
```swift
.background(.ultraThinMaterial)
UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
```

**Recommendation:**
```swift
.glassEffect() // iOS 26+ Liquid Glass
// Or keep .ultraThinMaterial for iOS 25 compatibility
```

## Limitations

**Cannot detect:**
- Runtime visual quality issues
- Specific design intent (some blur effects may be intentional)
- Context-specific material appropriateness

**False positives:**
- Views intentionally using older materials for iOS 25 compatibility
- Custom blur effects serving specific purposes

**For detailed implementation:** Use `/skill axiom:liquid-glass` after audit to understand design principles and correct implementation patterns.

## Requirements

- **iOS 26+** for Liquid Glass features
- **Xcode 26+** for latest SwiftUI APIs
- **SwiftUI codebase** (UIKit/AppKit apps: check for representables)

## See Also

- **[Liquid Glass Skill](/skills/ui-design/liquid-glass)** - Comprehensive implementation guide
- **[SwiftUI 26 Features Skill](/skills/ui-design/swiftui-26-features)** - All iOS 26 SwiftUI features
- **[SwiftUI Performance Skill](/skills/ui-design/swiftui-performance)** - Performance optimization
