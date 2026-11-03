---
name: swiftui-containers-ref
description: Reference — SwiftUI stacks, grids, outlines, custom containers, and scroll enhancements through iOS 27
skill_type: reference
version: 1.2.0
---

# SwiftUI Containers Reference

A reference for SwiftUI container views: stacks, grids, outlines, custom containers, and scroll enhancements from iOS 13 through iOS 27.

## When to Use This Reference

Use this reference when you're:

- Choosing the right container for a layout (stack vs lazy stack vs grid vs `List`)
- Fixing a list or grid that scrolls slowly and needs lazy loading
- Building hierarchical or outline UI (trees, sidebars, disclosure rows)
- Writing a reusable custom container that decorates, sections, or configures its children
- Adding scroll snapping, scroll position tracking, or scroll-driven effects
- Adopting the iOS 27 container additions (drag-to-reorder, swipe-action coordination, or a per-subtree `AsyncImage` session)

## Example Prompts

Questions you can ask your assistant that will draw from this reference:

- "Which container should I use for a 500-item scrolling list?"
- "How do I build a photo grid that adapts its column count to screen width?"
- "How do I build a custom container that puts a divider between its children?"
- "How do I add drag-to-reorder outside a `List` on iOS 27?"
- "How do I coordinate swipe actions in a `ScrollView` + `LazyVStack`?"
- "How do I make a horizontal carousel snap to each card?"

## What's Covered

### Stacks
- `VStack`, `HStack`, `ZStack` (and its nine alignments), `Spacer`
- `LazyVStack`, `LazyHStack`, pinned section headers

### Grids
- `Grid` and `GridRow` (iOS 16+), `gridCellColumns(_:)`, `gridColumnAlignment(_:)`
- `LazyVGrid`, `LazyHGrid`
- `GridItem.Size`: `.fixed`, `.flexible`, `.adaptive`

### Outlines
- `List` with `children:`, `OutlineGroup`, `DisclosureGroup`

### Performance
- When to use lazy containers, and caching `GridItem` arrays outside `body`
- iOS 26 list loading and update improvements; nested lazy stacks that defer loading
- Heavy rows: through iOS 26, neither `LazyVStack` nor `List` frees a visited row's state

### Scroll Enhancements
- `containerRelativeFrame`, `scrollTargetLayout`, `scrollTargetBehavior`, `scrollPosition(id:)` (iOS 17+)
- `scrollTransition`
- `onScrollGeometryChange`, `onScrollVisibilityChange` (iOS 18+)

### Custom Containers (iOS 18+)
- Declared vs resolved subviews
- `Group(subviews:)`, `ForEach(subviews:)`, `SubviewsCollection`, `Subview`
- `Group(sections:)`, `ForEach(sections:)`, `SectionConfiguration`
- `ContainerValues` + `@Entry` for container-specific modifiers
- Anti-patterns: `[Data]` row closures, `AnyView` inspection, `PreferenceKey` for per-child config

### iOS 27 Additions
- `reorderable()` and `reorderContainer(for:move:)` for drag-to-reorder in any container
- `swipeActionsContainer()` and the `onPresentationChanged:` swipe callback
- `asyncImageURLSession(_:)` for a per-subtree `AsyncImage` session

## Documentation Scope

This page documents the `containers-ref` skill (in the `axiom-swiftui` suite). The full patterns, code, and gotchas live in the skill, which your assistant loads on demand.

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
| Custom container that styles its children | Group(subviews:) / ForEach(subviews:) | 18+ |
| Custom container with sections | Group(sections:) / ForEach(sections:) | 18+ |
| Container-specific modifier on children | ContainerValues + @Entry | 18+ |

## When to Use Lazy

| Size | Scrollable? | Use |
|------|-------------|-----|
| 1–20 | No | VStack/HStack |
| 1–20 | Yes | VStack/HStack in ScrollView |
| 20–100 | Yes | LazyVStack/LazyHStack |
| 100+ | Yes | LazyVStack/LazyHStack or List |
| Grid <50 | No | Grid |
| Grid 50+ | Yes | LazyVGrid/LazyHGrid |

## Common Patterns

The skill leaves `spacing:` out on purpose: omitting it gives system spacing, the right default. The photo grid is the one deliberate exception.

### Photo Grid

```swift
// Near-zero gutters so the images read as a contact sheet
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
ScrollView(.horizontal) {
    LazyHStack {
        ForEach(items) { item in
            CarouselCard(item: item).frame(width: 280)
        }
    }
    .padding(.horizontal)
}
.scrollIndicators(.hidden)
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

## Related

- [swiftui-layout-ref](/reference/swiftui-layout-ref) – Adaptive layout across device sizes, and the lazy container gotchas behind heavy rows
- [swiftui-layout](/skills/ui-design/swiftui-layout) – Decides which layout approach fits before you pick a container
- [swiftui-nav-ref](/reference/swiftui-nav-ref) – Navigation containers such as `NavigationStack` and `NavigationSplitView`
- [swiftui-26-ref](/reference/swiftui-26-ref) – Other SwiftUI APIs new in iOS 26
- [hig](/skills/ui-design/hig) – How much space to put between things, which this reference leaves to design
- [swiftui-gestures](/skills/ui-design/swiftui-gestures) – Custom drag handling when swipe actions outside `List` aren't available
- [swiftui-performance-analyzer](/agents/swiftui-performance-analyzer) – Scans for janky scrolling, missing lazy containers, and excessive view updates

## Resources

**WWDC**: 2020-10031, 2022-10056, 2023-10148, 2024-10144, 2024-10146, 2025-256, 2026-321

**Docs**: /swiftui/lazyvstack, /swiftui/lazyvgrid, /swiftui/lazyhgrid, /swiftui/grid, /swiftui/outlinegroup, /swiftui/disclosuregroup, /swiftui/creating-custom-container-views, /swiftui/containervalues, /swiftui/view/swipeactionscontainer(), /swiftui/view/asyncimageurlsession(_:), /swiftui/dynamicviewcontent/reorderable(), /swiftui/reordering-items-in-lists-stacks-grids-and-custom-layouts
