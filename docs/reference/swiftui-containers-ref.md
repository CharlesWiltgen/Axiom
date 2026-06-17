---
name: swiftui-containers-ref
description: Reference — SwiftUI stacks, grids, outlines, and scroll enhancements through iOS 27
skill_type: reference
version: 1.2.0
---

# SwiftUI Containers Reference

Comprehensive reference for SwiftUI container views: stacks, grids, outlines, and scroll enhancements from iOS 13 through iOS 27.

## When to Use This Reference

Use this reference when you're:

- Choosing the right container for a layout (stack vs lazy stack vs grid vs `List`)
- Fixing a list or grid that scrolls slowly and needs lazy loading or the iOS 26 performance wins
- Building hierarchical or outline UI (trees, sidebars, disclosure rows)
- Adopting the iOS 27 container additions (drag-to-reorder, swipe-action coordination, or a per-subtree `AsyncImage` session)

## Example Prompts

Questions you can ask Claude that draw from this reference:

- "Which container should I use for a 500-item scrolling list?"
- "How do I build a photo grid that adapts its column count to screen width?"
- "How do I add drag-to-reorder outside a `List` on iOS 27?"
- "How do I coordinate swipe actions in a `ScrollView` + `LazyVStack`?"

## Overview

This reference covers all SwiftUI container APIs:

- **Stacks** – VStack, HStack, ZStack, Spacer
- **Lazy Stacks** – LazyVStack, LazyHStack with pinned headers
- **Grids** – Grid (iOS 16+), LazyVGrid, LazyHGrid, GridItem sizing
- **Outlines** – List with `children:`, OutlineGroup, DisclosureGroup
- **Scroll Enhancements** – containerRelativeFrame, scrollTargetLayout, scrollPosition (iOS 17+), onScrollGeometryChange, onScrollVisibilityChange (iOS 18+)
- **iOS 26 Performance** – 6x faster list loading, 16x faster updates, nested lazy stack optimization
- **iOS 27 Additions** – `reorderable()` drag-to-reorder in any container, `swipeActionsContainer()` coordination with the `onPresentationChanged` swipe callback, `asyncImageURLSession()`

## Documentation Scope

This page is a lookup surface for the `axiom-swiftui` skill's container reference (`skills/containers-ref.md`); the full patterns, code, and gotchas live in that skill, which Claude loads on demand.

- For container performance problems (janky scrolling, excessive view updates), use the [swiftui-performance-analyzer](/agents/swiftui-performance-analyzer) agent
- For adaptive layout that breaks across device sizes, see the [SwiftUI layout reference](/reference/swiftui-layout-ref)
- For navigation containers (NavigationStack, NavigationSplitView), see the [SwiftUI navigation reference](/reference/swiftui-nav-ref)

## Quick Decision

| Use Case | Container | iOS |
|----------|-----------|-----|
| Fixed views vertical/horizontal | VStack / HStack | 13+ |
| Overlapping views | ZStack | 13+ |
| Large scrollable list | LazyVStack / LazyHStack | 14+ |
| Multi-column grid | LazyVGrid | 14+ |
| Multi-row grid (horizontal) | LazyHGrid | 14+ |
| Static grid, precise alignment | Grid | 16+ |
| Hierarchical data (tree) | List with `children:` | 14+ |
| Custom hierarchies | OutlineGroup | 14+ |
| Show/hide content | DisclosureGroup | 14+ |

## When to Use Lazy

| Size | Scrollable? | Use |
|------|-------------|-----|
| 1-20 | No | VStack/HStack |
| 1-20 | Yes | VStack/HStack in ScrollView |
| 20-100 | Yes | LazyVStack/LazyHStack |
| 100+ | Yes | LazyVStack/LazyHStack or List |
| Grid <50 | No | Grid |
| Grid 50+ | Yes | LazyVGrid/LazyHGrid |

## Common Patterns

### Photo Grid

```swift
let columns = [GridItem(.adaptive(minimum: 100), spacing: 2)]

ScrollView {
    LazyVGrid(columns: columns, spacing: 2) {
        ForEach(photos) { photo in
            AsyncImage(url: photo.thumbnailURL) { image in
                image.resizable().aspectRatio(1, contentMode: .fill)
            } placeholder: { Color.gray }
            .aspectRatio(1, contentMode: .fill)
            .clipped()
        }
    }
}
```

### Horizontal Carousel

```swift
ScrollView(.horizontal, showsIndicators: false) {
    LazyHStack(spacing: 16) {
        ForEach(items) { item in
            CarouselCard(item: item).frame(width: 280)
        }
    }
    .padding(.horizontal)
}
```

### File Browser

```swift
List(selection: $selection) {
    OutlineGroup(rootItems, children: \.children) { item in
        Label {
            Text(item.name)
        } icon: {
            Image(systemName: item.children != nil ? "folder.fill" : "doc.fill")
        }
    }
}
.listStyle(.sidebar)
```

## Resources

**WWDC**: 2020-10031, 2022-10056, 2023-10148, 2024-10144, 2025-256, 2026-321

**Docs**: /swiftui/lazyvstack, /swiftui/lazyvgrid, /swiftui/lazyhgrid, /swiftui/grid, /swiftui/outlinegroup, /swiftui/disclosuregroup, /swiftui/view/swipeactionscontainer(), /swiftui/view/asyncimageurlsession(_:), /swiftui/dynamicviewcontent/reorderable(), /swiftui/view/reordercontainer(for:move:), /swiftui/reordering-items-in-lists-stacks-grids-and-custom-layouts

**Skills**: 
