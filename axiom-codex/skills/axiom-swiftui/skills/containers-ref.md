
# SwiftUI Containers Reference

Stacks, grids, outlines, and scroll enhancements. iOS 14 through iOS 26.

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

---

## Part 1: Stacks

### VStack, HStack, ZStack

```swift
VStack(alignment: .leading, spacing: 12) {
    Text("Title")
    Text("Subtitle")
}

HStack(alignment: .top, spacing: 8) {
    Image(systemName: "star")
    Text("Rating")
}

ZStack(alignment: .bottomTrailing) {
    Image("photo")
    Badge()
}
```

**ZStack alignments**: `.center` (default), `.top`, `.bottom`, `.leading`, `.trailing`, `.topLeading`, `.topTrailing`, `.bottomLeading`, `.bottomTrailing`

### Spacer

```swift
HStack {
    Text("Left")
    Spacer()
    Text("Right")
}

Spacer(minLength: 20)  // Minimum size
```

---

### LazyVStack, LazyHStack (iOS 14+)

Render children only when visible. Use inside ScrollView.

```swift
ScrollView {
    LazyVStack(spacing: 0) {
        ForEach(items) { item in
            ItemRow(item: item)
        }
    }
}
```

### Pinned Section Headers

```swift
ScrollView {
    LazyVStack(pinnedViews: [.sectionHeaders]) {
        ForEach(sections) { section in
            Section(header: SectionHeader(section)) {
                ForEach(section.items) { item in
                    ItemRow(item: item)
                }
            }
        }
    }
}
```

---

## Part 2: Grids

### Grid (iOS 16+)

Non-lazy grid with precise alignment. Loads all views at once.

```swift
Grid(alignment: .leading, horizontalSpacing: 10, verticalSpacing: 10) {
    GridRow {
        Text("Name")
        TextField("Enter name", text: $name)
    }
    GridRow {
        Text("Email")
        TextField("Enter email", text: $email)
    }
}
```

**Modifiers**:
- `gridCellColumns(_:)` — Span multiple columns
- `gridColumnAlignment(_:)` — Override column alignment

```swift
Grid {
    GridRow {
        Text("Header").gridCellColumns(2)
    }
    GridRow {
        Text("Left")
        Text("Right").gridColumnAlignment(.trailing)
    }
}
```

---

### LazyVGrid (iOS 14+)

Vertical-scrolling grid. Define **columns**; rows grow unbounded.

```swift
let columns = [
    GridItem(.flexible()),
    GridItem(.flexible()),
    GridItem(.flexible())
]

ScrollView {
    LazyVGrid(columns: columns, spacing: 16) {
        ForEach(items) { item in
            ItemCard(item: item)
        }
    }
}
```

### LazyHGrid (iOS 14+)

Horizontal-scrolling grid. Define **rows**; columns grow unbounded.

```swift
let rows = [GridItem(.fixed(100)), GridItem(.fixed(100))]

ScrollView(.horizontal) {
    LazyHGrid(rows: rows, spacing: 16) {
        ForEach(items) { item in
            ItemCard(item: item)
        }
    }
}
```

### GridItem.Size

| Size | Behavior |
|------|----------|
| `.fixed(CGFloat)` | Exact width/height |
| `.flexible(minimum:maximum:)` | Fills space equally |
| `.adaptive(minimum:maximum:)` | Creates as many as fit |

```swift
// Adaptive: responsive column count
let columns = [GridItem(.adaptive(minimum: 150))]
```

---

## Part 3: Outlines

### List with Hierarchical Data (iOS 14+)

```swift
struct FileItem: Identifiable {
    let id = UUID()
    var name: String
    var children: [FileItem]?  // nil = leaf
}

List(files, children: \.children) { file in
    Label(file.name, systemImage: file.children != nil ? "folder" : "doc")
}
.listStyle(.sidebar)
```

### OutlineGroup (iOS 14+)

For custom hierarchical layouts outside List.

```swift
List {
    ForEach(canvases) { canvas in
        Section(header: Text(canvas.name)) {
            OutlineGroup(canvas.graphics, children: \.children) { graphic in
                GraphicRow(graphic: graphic)
            }
        }
    }
}
```

### DisclosureGroup (iOS 14+)

```swift
@State private var isExpanded = false

DisclosureGroup("Advanced Options", isExpanded: $isExpanded) {
    Toggle("Enable Feature", isOn: $feature)
    Slider(value: $intensity)
}
```

---

## Part 4: Common Patterns

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

---

## Part 5: Performance

### When to Use Lazy

| Size | Scrollable? | Use |
|------|-------------|-----|
| 1-20 | No | VStack/HStack |
| 1-20 | Yes | VStack/HStack in ScrollView |
| 20-100 | Yes | LazyVStack/LazyHStack |
| 100+ | Yes | LazyVStack/LazyHStack or List |
| Grid <50 | No | Grid |
| Grid 50+ | Yes | LazyVGrid/LazyHGrid |

**Cache GridItem arrays** — define outside body:

```swift
struct ContentView: View {
    let columns = [GridItem(.adaptive(minimum: 150))]  // ✅
    var body: some View {
        LazyVGrid(columns: columns) { ... }
    }
}
```

### iOS 26 Performance

- Significant list loading and update performance improvements for large datasets
- Reduced dropped frames in scrolling
- Nested ScrollViews with lazy stacks now properly defer loading:

```swift
ScrollView(.horizontal) {
    LazyHStack {
        ForEach(photoSets) { set in
            ScrollView(.vertical) {
                LazyVStack {
                    ForEach(set.photos) { PhotoView(photo: $0) }
                }
            }
        }
    }
}
```

---

## Part 6: Scroll Enhancements

### containerRelativeFrame (iOS 17+)

Size views relative to scroll container.

```swift
ScrollView(.horizontal) {
    LazyHStack {
        ForEach(cards) { card in
            CardView(card: card)
                .containerRelativeFrame(.horizontal, count: 3, span: 1, spacing: 16)
        }
    }
}
```

### scrollTargetLayout (iOS 17+)

Enable snapping.

```swift
ScrollView(.horizontal) {
    LazyHStack {
        ForEach(items) { ItemCard(item: $0) }
    }
    .scrollTargetLayout()
}
.scrollTargetBehavior(.viewAligned)
```

### scrollPosition (iOS 17+)

Track topmost visible item. **Requires `.id()` on each item.**

```swift
@State private var position: Item.ID?

ScrollView {
    LazyVStack {
        ForEach(items) { item in
            ItemRow(item: item).id(item.id)
        }
    }
}
.scrollPosition(id: $position)
```

### scrollTransition (iOS 17+)

```swift
.scrollTransition { content, phase in
    content
        .opacity(1 - abs(phase.value) * 0.5)
        .scaleEffect(phase.isIdentity ? 1.0 : 0.75)
}
```

### onScrollGeometryChange (iOS 18+)

```swift
.onScrollGeometryChange(for: Bool.self) { geo in
    geo.contentOffset.y < geo.contentInsets.top
} action: { _, isTop in
    showBackButton = !isTop
}
```

### onScrollVisibilityChange (iOS 18+)

```swift
VideoPlayer(player: player)
    .onScrollVisibilityChange(threshold: 0.2) { visible in
        visible ? player.play() : player.pause()
    }
```

---

## Part 7: Custom Containers (iOS 18+)

Container View APIs let you build reusable containers that decompose their children — applying decoration between them, grouping them into sections, or reading per-child configuration. This is how you write a `List` replacement instead of a one-off layout.

### When to Reach for These APIs

| Situation | Use |
|-----------|-----|
| Container needs to insert decoration between children (dividers, separators) | `Group(subviews:)` to count + index |
| Container iterates children and wraps each one | `ForEach(subviews:)` |
| Container must respect `Section` boundaries with header/footer | `Group(sections:)` or `ForEach(sections:)` |
| Need a `.listRowSeparator(.hidden)`-style modifier on children | `ContainerValues` + `@Entry` |
| Children come from arbitrary view-builder content (not a `[Data]`) | All of the above |

If you only need a one-off layout and don't care about composition, `VStack`/`LazyVStack` + a `[Data]` parameter is simpler. Reach for these APIs when you're building a **reusable primitive**.

### Declared vs. Resolved Subviews

The mental model that makes the rest of this make sense:

- **Declared subviews** — what's written in the view-builder closure (a `Text`, a `ForEach`, an `if`, an `EmptyView`)
- **Resolved subviews** — what actually appears on screen after SwiftUI evaluates `ForEach`, conditionals, and groups

`Group(subviews:)` and `ForEach(subviews:)` iterate **resolved** subviews, so a single `ForEach(songs)` over 9 items resolves to 9 cards — your container doesn't need a separate `[Data]` parameter.

### Group(subviews:) — Decompose with Count Awareness

Use when the container needs to know *how many* children it has (e.g., to scale them or change layout):

```swift
struct Board<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        BoardLayout {
            Group(subviews: content) { subviews in
                ForEach(subviews) { subview in
                    CardView(scale: subviews.count > 15 ? .small : .normal) {
                        subview
                    }
                }
            }
        }
    }
}

// Caller — composes any mix of static + dynamic content
Board {
    Text("Pinned")
    ForEach(items) { item in Text(item.title) }
}
```

`subviews` is a `SubviewsCollection` exposing `count`, `first`, `last`, and `Identifiable` iteration. Each `Subview` has `id` and `containerValues`.

### ForEach(subviews:) — Decompose Without Count

Shorter form when count isn't needed — just iterate and wrap each child:

```swift
struct StackedCards<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(subviews: content) { subview in
                CardView { subview }
            }
        }
    }
}
```

If you need "insert a divider between children but not after the last one," `ForEach(subviews:)` alone can't tell you which subview is last. Use `Group(subviews:)` instead so you can compare ids:

```swift
struct DividedCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading) {
            Group(subviews: content) { subviews in
                ForEach(subviews) { subview in
                    subview
                    if subview.id != subviews.last?.id {
                        Divider().padding(.vertical, 8)
                    }
                }
            }
        }
    }
}
```

### Group(sections:) / ForEach(sections:) — Respect Section Boundaries

Sections are `Section { ... } header: { ... } footer: { ... }` blocks in the caller's content. To honor them, iterate sections instead of subviews:

```swift
struct SectionedBoard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        HStack(spacing: 80) {
            ForEach(sections: content) { section in
                VStack(spacing: 20) {
                    if !section.header.isEmpty {
                        SectionHeaderCard { section.header }
                    }
                    BoardLayout {
                        ForEach(section.content) { subview in
                            CardView { subview }
                        }
                    }
                    if !section.footer.isEmpty {
                        SectionFooterCard { section.footer }
                    }
                }
            }
        }
    }
}
```

`SectionConfiguration` exposes:
- `header` / `content` / `footer` — each a `SubviewsCollection`
- `id` — section identity
- `containerValues` — per-section configuration (see below)
- `isEmpty` on `header`/`footer` — check before rendering chrome

Content not wrapped in `Section` automatically forms an implicit section, so `ForEach(sections:)` works even when the caller writes flat content.

### ContainerValues + @Entry — Container-Specific Modifiers

This is how `List` implements `.listRowSeparator(.hidden)`: a modifier that's only meaningful inside a specific container. Define one in two steps.

#### Step 1 — Declare the Value

```swift
extension ContainerValues {
    @Entry var isBoardCardRejected: Bool = false
}

extension View {
    func boardCardRejected(_ rejected: Bool = true) -> some View {
        containerValue(\.isBoardCardRejected, rejected)
    }
}
```

#### Step 2 — Read It Inside the Container

```swift
ForEach(subviews: content) { subview in
    CardView(isRejected: subview.containerValues.isBoardCardRejected) {
        subview
    }
}
```

#### Caller

```swift
Board {
    Text("Keeper")
    Text("Skip this one")
        .boardCardRejected()
    Section("Maybes") {
        ForEach(items) { Text($0.title) }
    }
    .boardCardRejected()  // applies to every card in the section
}
```

Container values differ from environment values and preferences in scope:
- **Environment** — flows down the entire view hierarchy
- **Preferences** — flows up the entire hierarchy with merging
- **Container values** — visible only to the **immediate** container; do not escape

That bounded scope is the whole point — it's why `.listRowSeparator(.hidden)` doesn't accidentally affect a `LazyVStack` higher in the tree.

### Anti-Patterns

| Mistake | Fix |
|---------|-----|
| Custom container takes `[Data]` and `ViewBuilder` row closure (List-style) | Take a single `@ViewBuilder var content: Content` and use `ForEach(subviews:)` — supports static, dynamic, and mixed content |
| Using `AnyView` to inspect children | Use `Subview` proxies via `Group(subviews:)` — preserves identity and modifiers |
| Reading per-child config via `PreferenceKey` | Use `ContainerValues` + `@Entry` — bounded scope, no merging surprises |
| Iterating `content as? Group` to count children | Use `Group(subviews:) { $0.count }` — works for any composition, not just literal `Group` |
| Section-aware container that drops headers/footers | Always check `section.header.isEmpty` and render header chrome conditionally |

### Performance

`Subview` proxies are lazy — `Group(subviews:)` and `ForEach(subviews:)` resolve children on demand. For large datasets, embed your custom container inside a `ScrollView` + `LazyVStack` (or use `LazyVStack` itself as the layout) so resolution stays incremental.

---

## Resources

**WWDC**: 2020-10031, 2022-10056, 2023-10148, 2024-10144, 2024-10146, 2025-256

**Docs**: /swiftui/lazyvstack, /swiftui/lazyvgrid, /swiftui/lazyhgrid, /swiftui/grid, /swiftui/outlinegroup, /swiftui/disclosuregroup, /swiftui/group/init(subviews:transform:), /swiftui/group/init(sections:transform:), /swiftui/foreach/init(subviews:content:), /swiftui/foreach/init(sections:content:), /swiftui/subview, /swiftui/sectionconfiguration, /swiftui/containervalues, /swiftui/creating-custom-container-views

**Skills**: skills/layout.md, skills/layout-ref.md, skills/nav.md, skills/26-ref.md
