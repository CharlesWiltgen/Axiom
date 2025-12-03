---
name: audit-liquid-glass
description: Quick automated scan for Liquid Glass adoption opportunities in SwiftUI codebase — identifies views that could benefit from glass effects, toolbar improvements, search patterns, and migration opportunities from older blur effects
---

# Liquid Glass Adoption Audit

Scan your SwiftUI codebase for Liquid Glass adoption opportunities and potential improvements.

## What This Command Does

Performs automated checks for:

1. **Custom Views for Glass Effects** — Views that could benefit from `.glassBackgroundEffect()`
2. **Toolbar Improvements** — Missing `.borderedProminent` buttons, opportunities for `Spacer(.fixed)`
3. **Search Patterns** — `.searchable()` that could be bottom-aligned or use `.tabRole(.search)`
4. **Migration Opportunities** — `UIBlurEffect`, `NSVisualEffectView`, old blur modifiers
5. **Missing Tinting** — Toolbar buttons that could use `.tint()` for prominence

## Scan Categories

### 1. Custom Views for Glass Background Effect

**Looks for** Custom view types (non-standard SwiftUI views) that might benefit from `.glassBackgroundEffect()`

#### Pattern
```swift
// Search for custom views in galleries, overlays, cards
struct CustomPhotoView: View { }
struct OverlayCard: View { }
struct GalleryContainer: View { }
```

**Recommendation** Consider `.glassBackgroundEffect()` for custom views that should reflect surrounding content.

---

### 2. Toolbar Button Improvements

#### Looks for
- Toolbars with multiple buttons that lack `Spacer(.fixed)` for grouping
- Primary action buttons missing `.buttonStyle(.borderedProminent)`
- Prominent buttons missing `.tint()` for color

#### Pattern
```swift
.toolbar {
    Button("Action1") { }
    Button("Action2") { }
    Button("Settings") { }  // Could benefit from Spacer(.fixed) before this
}
```

**Recommendation** Use `Spacer(.fixed)` to separate button groups, `.borderedProminent` + `.tint()` for primary actions.

---

### 3. Search Pattern Opportunities

#### Looks for
- `.searchable()` on views that aren't in `NavigationSplitView` (won't get automatic bottom-alignment)
- `TabView` with search-related tabs missing `.tabRole(.search)`

#### Pattern
```swift
// Check if searchable is properly placed
NavigationSplitView {
    List { }
        .searchable(text: $query) // ✅ Gets bottom-alignment automatically
}

// vs
List { }
    .searchable(text: $query) // ⚠️ Won't get platform-specific placement
```

---

### 4. Migration from Old Blur Effects

#### Looks for
- `UIBlurEffect` usage (UIKit)
- `NSVisualEffectView` usage (AppKit)
- `.blur()` modifier on backgrounds
- `Material` usage that could migrate to Liquid Glass

#### Pattern
```swift
// Old patterns to migrate
UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
.background(.ultraThinMaterial)
.blur(radius: 10)
```

**Recommendation** Migrate to `.glassEffect()` or `.glassBackgroundEffect()` for iOS 26+.

---

### 5. Tinting Opportunities

#### Looks for
- `.borderedProminent` buttons without `.tint()`
- Toolbar buttons that could be more prominent

#### Pattern
```swift
Button("Add") { }
    .buttonStyle(.borderedProminent)
    // Missing .tint() for custom color
```

---

## Execution Steps

1. **Glob for SwiftUI files**
```
**/*.swift (exclude: Tests/, Previews/, Generated/)
```

2. **For each file, grep for patterns**

#### Custom views
```regex
struct \w+View: View
struct \w+(Card|Container|Overlay|Gallery): View
```

#### Toolbars
```regex
\.toolbar\s*\{
ToolbarItem
ToolbarItemGroup
```

#### Search
```regex
\.searchable\(
\.tabRole\(
TabView\s*\{
```

#### Old blur effects
```regex
UIBlurEffect
NSVisualEffectView
\.blur\(
\.background\(.*Material
```

#### Tinting
```regex
\.borderedProminent
\.tint\(
```

3. **Analyze findings**
   - Count occurrences per category
   - Flag high-priority items (old blur effects, missing toolbar improvements)
   - Suggest next steps

4. **Generate report**

```
Liquid Glass Adoption Audit Results
=====================================

Summary:
  Custom Views: 12 found
  Toolbars: 8 found (3 could use Spacer(.fixed), 2 missing .borderedProminent)
  Search: 4 found (2 not in NavigationSplitView)
  Migration Opportunities: 6 old blur effects found
  Tinting: 3 .borderedProminent buttons missing .tint()

High Priority:
  1. Migrate 6 UIBlurEffect/NSVisualEffectView instances to Liquid Glass
  2. Add .borderedProminent to 2 primary toolbar actions
  3. Move 2 .searchable() calls to NavigationSplitView for bottom-alignment

Medium Priority:
  4. Add Spacer(.fixed) to 3 toolbars for button grouping
  5. Add .tint() to 3 prominent buttons
  6. Consider .glassBackgroundEffect() for 12 custom views

Low Priority:
  7. Review 4 .searchable() implementations for .tabRole(.search) opportunity

Next Steps:
  - Review High Priority items first (migration + prominence)
  - Use /skill liquid-glass for detailed implementation guidance
  - Test on iOS 26+ devices to verify visual appearance
```

---

## Output Format

#### For each category
1. File path and line number
2. Code snippet showing current implementation
3. Recommended improvement with example code
4. Priority level (High/Medium/Low)

#### Summary at end
- Total opportunities found
- Prioritized list of recommendations
- Links to relevant skills for implementation

---

## Example Output

```
=== Liquid Glass Audit: CustomPhotoView.swift ===

Line 45: Custom view without glass effect
  Current:
    struct PhotoGalleryView: View {
        var body: some View {
            CustomPhotoGrid()
        }
    }

  Recommendation [MEDIUM]:
    struct PhotoGalleryView: View {
        var body: some View {
            CustomPhotoGrid()
                .glassBackgroundEffect() // Reflects surrounding photos
        }
    }

---

=== Liquid Glass Audit: ToolbarView.swift ===

Line 23: Toolbar missing button grouping
  Current:
    .toolbar {
        Button("Up") { }
        Button("Down") { }
        Button("Settings") { }
    }

  Recommendation [MEDIUM]:
    .toolbar {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button("Up") { }
            Button("Down") { }

            Spacer(.fixed) // Separate navigation from settings

            Button("Settings") { }
        }
    }

---

=== Liquid Glass Audit: MainView.swift ===

Line 67: Old blur effect detected
  Current:
    .background(.ultraThinMaterial)

  Recommendation [HIGH - Migration]:
    .glassEffect() // iOS 26+ Liquid Glass
    // Or keep .ultraThinMaterial for iOS 18 compatibility

  Migration Note: If targeting iOS 26+, migrate to Liquid Glass for
  better visual consistency and performance.

---

Summary:
  - 1 custom view opportunity (medium priority)
  - 1 toolbar improvement (medium priority)
  - 1 migration opportunity (high priority)

For implementation details, use: /skill liquid-glass
```

---

## Implementation Notes

#### Grep patterns to use

```bash
# Custom views
grep -n "struct.*View.*{" **/*.swift

# Toolbars
grep -n "\.toolbar" **/*.swift
grep -n "ToolbarItem" **/*.swift

# Search
grep -n "\.searchable" **/*.swift
grep -n "TabView" **/*.swift

# Old blur
grep -n "UIBlurEffect\|NSVisualEffectView\|\.blur(" **/*.swift
grep -n "Material" **/*.swift

# Tinting
grep -n "\.borderedProminent" **/*.swift
```

#### Analysis logic

1. Custom views: Flag any struct with "View" suffix not in standard SwiftUI (List, HStack, etc.)
2. Toolbars: Count buttons, check for `Spacer(.fixed)`, check for `.borderedProminent`
3. Search: Verify `.searchable()` is on `NavigationSplitView`, check for `.tabRole(.search)` on TabView
4. Migration: Flag all UIKit/AppKit blur effects as high priority
5. Tinting: Flag `.borderedProminent` without `.tint()` nearby

#### Priority levels

- **HIGH**: Migration from old blur effects, missing primary action prominence
- **MEDIUM**: Toolbar spacing, search placement, tinting opportunities
- **LOW**: Custom view enhancements, optional improvements

---

## Cross-References

After audit, use these skills for implementation:

- `/skill liquid-glass` - Liquid Glass implementation with design review pressure defense
- `/skill liquid-glass-ref` - Comprehensive app-wide adoption guide (app icons, controls, navigation, menus, windows)
- `/skill swiftui-26-ref` - All iOS 26 SwiftUI features including Liquid Glass APIs

---

## Requirements

- **iOS 26+** for Liquid Glass features
- **Xcode 26+** for latest SwiftUI APIs
- **SwiftUI codebase** (UIKit/AppKit apps: check for representables)
