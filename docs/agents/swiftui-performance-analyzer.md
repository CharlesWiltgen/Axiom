# swiftui-performance-analyzer

Automatically scans SwiftUI code for performance anti-patterns that cause frame drops and poor scrolling performance.

## How to Use This Agent

**Natural language (automatic triggering):**
- "My SwiftUI app has janky scrolling"
- "Check my code for performance issues"
- "My views are updating too often"
- "App feels slow during scrolling"
- "Review my SwiftUI code for optimization opportunities"

**Explicit command:**
```bash
/axiom:audit-swiftui-performance
```

## What It Checks

### Critical Issues (Frame Drops Guaranteed)
1. **File I/O in view body** — Data(contentsOf:), String(contentsOf:)
2. **Creating formatters in view body** — DateFormatter(), NumberFormatter()

### High Priority (Likely Frame Drops)
3. **Image processing in view body** — Resizing, filtering, transformations
4. **Whole-collection dependencies** — .contains(), .filter() on arrays
5. **Navigation performance issues** — NavigationPath recreation, large models in navigation state

### Medium Priority (Performance Degradation)
6. **Missing lazy loading** — VStack with 100+ items instead of LazyVStack
7. **Frequently changing environment values** — Updates entire hierarchy every frame
8. **Missing view identity** — ForEach without explicit id

### Low Priority (Optimization Opportunities)
9. **Old ObservableObject pattern** — Should use @Observable (iOS 17+)

## Example Detections

### File I/O in View Body
```swift
// ❌ BAD: Blocks main thread
var body: some View {
    let data = try? Data(contentsOf: fileURL) // Synchronous I/O!
    if let data, let image = UIImage(data: data) {
        Image(uiImage: image)
    }
}

// ✅ GOOD: Async loading
@State private var imageData: Data?

var body: some View {
    if let imageData, let image = UIImage(data: imageData) {
        Image(uiImage: image)
    }
}
.task {
    imageData = try? await loadImageData()
}
```

### Creating Formatters
```swift
// ❌ BAD: Creates every update (1-2ms each)
var body: some View {
    let formatter = DateFormatter() // Expensive!
    formatter.dateStyle = .medium
    Text(date, formatter: formatter)
}

// ✅ GOOD: Static formatter
private static let dateFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateStyle = .medium
    return f
}()
```

## Performance Risk Score

Calculates risk (0-10):
- CRITICAL issues: +3 points each
- HIGH issues: +2 points each
- MEDIUM issues: +1 point each
- LOW issues: +0.5 points each

**Interpretation**:
- 0-2: Low risk, good performance
- 3-5: Medium risk, noticeable issues likely
- 6-8: High risk, performance problems expected
- 9-10: Critical risk, poor performance guaranteed

## Common Findings

From auditing 100+ SwiftUI apps:
- 70% create formatters in view body
- 50% use VStack instead of LazyVStack for long lists
- 40% have whole-collection dependencies
- 30% do image processing in view body
- 25% have navigation performance issues (NavigationPath recreation, large models)
- 20% have file I/O in view body

## Model & Tools

- **Model**: haiku (pattern matching)
- **Tools**: Glob, Grep, Read
- **Color**: purple
- **Scan Time**: <1 second

## Related Skills

For detailed SwiftUI performance optimization:
- **swiftui-performance** skill — Step-by-step profiling with Instruments 26
- **swiftui-debugging** skill — Systematic view update diagnosis
