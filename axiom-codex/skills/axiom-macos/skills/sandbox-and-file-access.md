# macOS App Sandbox and File Access

## When to Use This Skill

Use when:
- Building a new macOS app that will ship on the Mac App Store
- App works in debug but fails in release, TestFlight, or production
- Getting "Operation not permitted" or "sandbox violation" errors
- Implementing file open/save/import workflows on macOS
- Persisting access to user-selected files across app launches
- Preparing a macOS app for App Store review or notarization
- Deciding which sandbox entitlements to request

#### Related Skills
- Use the distribution skill in this suite for code signing, notarization, and packaging
- Use `axiom-security` for Keychain, encryption, passkeys, and certificate management
- Use `axiom-integration` for App Groups and inter-process file sharing

## Red Flags — Anti-Patterns to Prevent

If you're doing ANY of these, STOP and use the patterns in this skill:

### ❌ CRITICAL — Never Do These

#### 1. Never testing in a sandboxed environment
```swift
// You built and ran from Xcode, it worked, you shipped.
// Then users report "can't open files" or "settings lost."
```
**Why this fails**: Xcode debug builds do NOT enable the sandbox by default. Your app has full disk access during development. Every file operation that works in debug can silently fail in release. This is the #1 cause of "works on my machine" bugs in macOS development.

#### 2. Hardcoding file paths
```swift
// ❌ WRONG — Path differs per user, breaks in sandbox
let configPath = "/Users/charles/Library/Application Support/MyApp/config.json"
```
**Why this fails**: Sandboxed apps get a container at `~/Library/Containers/<bundle-id>/`. Hardcoded paths point outside the container and will be denied. Use `FileManager` APIs to resolve paths.

#### 3. Forgetting to call stopAccessingSecurityScopedResource()
```swift
// ❌ WRONG — Kernel resource leak
let url = try URL(resolvingBookmarkData: data, options: .withSecurityScope,
                  bookmarkDataIsStale: &isStale)
url.startAccessingSecurityScopedResource()
let contents = try Data(contentsOf: url)
// ... never calls stopAccessingSecurityScopedResource()
```
**Why this fails**: Apple's documentation warns explicitly: "Failing to properly relinquish access leaks kernel resources, and sufficient kernel resource leaks can prevent your app from accessing file-system locations until relaunching." Every unbalanced `startAccessing` call leaks a kernel resource. Enough leaks and ALL file access stops working until the user force-quits your app.

#### 4. Storing bookmark data in UserDefaults
```swift
// ❌ WRONG — UserDefaults has size limits and sync issues
UserDefaults.standard.set(bookmarkData, forKey: "lastFile")
```
**Why this fails**: Bookmark data can be several KB. UserDefaults is not designed for binary blobs, has size limits, and syncs unpredictably. Store bookmarks in a dedicated file in your app's container.

#### 5. Assuming fileImporter URLs are permanently accessible
```swift
// ❌ WRONG — URL access expires when scope ends
.fileImporter(isPresented: $showImporter, allowedContentTypes: [.pdf]) { result in
    self.savedURL = try? result.get().first  // Saving URL for later
}
// Later, in a different view lifecycle...
let data = try Data(contentsOf: savedURL!)  // May fail — access revoked
```
**Why this fails**: URLs from `fileImporter` are security-scoped. Access is temporary. To use the file later or after relaunch, you must create a security-scoped bookmark immediately in the completion handler.

---

## The Sandbox Model

### What the Sandbox Does

The App Sandbox is a kernel-level access control system. It restricts your app to:
- Its own container directory (`~/Library/Containers/<bundle-id>/`)
- Files the user explicitly grants access to (via open/save panels, drag-and-drop)
- Resources declared via entitlements (network, hardware, standard folders)

Everything else is denied at the kernel level. No amount of error handling in your code can work around a sandbox denial — the operation simply fails.

### Why Debug Builds Bypass It

Xcode's default debug configuration does NOT sandbox your app. This means:
- `FileManager` calls succeed on any path
- Network connections work without entitlements
- Hardware access works without permission prompts

This is convenient for development but dangerous for shipping. You must test in the sandbox before release.

### How to Test in the Sandbox

#### Method 1: Verify sandbox is active (Activity Monitor)
1. Build and run your app from Xcode
2. Open Activity Monitor
3. View > Columns > Sandbox
4. Check that your app shows "Yes" in the Sandbox column

If it shows "No", your app is not sandboxed in debug. To enable it:

#### Method 2: Enable sandbox in debug
1. Select your target in Xcode
2. Signing & Capabilities tab
3. Add "App Sandbox" capability if not present
4. The `com.apple.security.app-sandbox` entitlement is added to your entitlements file

#### Method 3: Test the release build
```bash
# Archive and export for testing
xcodebuild archive -scheme MyApp -archivePath MyApp.xcarchive
xcodebuild -exportArchive -archivePath MyApp.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath ./build
# Run the exported app — it will be sandboxed
```

#### Method 4: TestFlight
TestFlight builds are always sandboxed. This is your best pre-release validation.

---

## File Access Patterns

### Decision Tree

```
Need to access a file?
├─ File is inside your app's container?
│  └─ Just read/write it — no special handling needed
├─ User picks a file interactively?
│  ├─ SwiftUI app?
│  │  └─ Use .fileImporter / .fileExporter
│  └─ AppKit app?
│     └─ Use NSOpenPanel / NSSavePanel
├─ Need to access the same file next launch?
│  └─ Create a security-scoped bookmark (see next section)
├─ Need access to Downloads/Pictures/Music/Movies?
│  └─ Add the specific folder entitlement
├─ Need to share files between your apps?
│  └─ Use App Group container
└─ Need access to arbitrary files?
   └─ User must grant Full Disk Access in System Settings
      (you cannot request this programmatically)
```

### SwiftUI File Import

```swift
struct ContentView: View {
    @State private var showImporter = false

    var body: some View {
        Button("Open File") { showImporter = true }
            .fileImporter(
                isPresented: $showImporter,
                allowedContentTypes: [.plainText, .pdf],
                allowsMultipleSelection: false
            ) { result in
                switch result {
                case .success(let urls):
                    guard let url = urls.first else { return }

                    // Access is already started for URLs from fileImporter
                    defer { url.stopAccessingSecurityScopedResource() }

                    // Read the file
                    let data = try? Data(contentsOf: url)

                    // If you need this file later, bookmark it NOW
                    saveBookmark(for: url)

                case .failure(let error):
                    // Handle — do not swallow silently
                    logger.error("File import failed: \(error.localizedDescription)")
                }
            }
    }
}
```

### AppKit Open Panel

```swift
let panel = NSOpenPanel()
panel.allowedContentTypes = [.plainText]
panel.allowsMultipleSelection = false

panel.begin { response in
    guard response == .OK, let url = panel.url else { return }

    // Access is already started for URLs from NSOpenPanel
    defer { url.stopAccessingSecurityScopedResource() }

    let data = try? Data(contentsOf: url)

    // Bookmark if needed for future access
    saveBookmark(for: url)
}
```

### Key Rule

URLs from open panels, save panels, `fileImporter`, and Dock drag-and-drop all come with security-scoped access already started. You MUST call `stopAccessingSecurityScopedResource()` when done. If you need the file again later, create a bookmark before stopping access.

---

## Security-Scoped Bookmarks

This is the pattern developers get wrong most often. Follow every step.

### Step 1: Create the Bookmark

Create bookmark data immediately when you have access to the file — typically in the `fileImporter` completion or `NSOpenPanel` callback.

```swift
func saveBookmark(for url: URL) {
    do {
        let bookmarkData = try url.bookmarkData(
            options: .withSecurityScope,
            includingResourceValuesForKeys: nil,
            relativeTo: nil
        )
        // Store in a file, NOT UserDefaults
        try bookmarkData.write(to: bookmarkStorageURL)
    } catch {
        logger.error("Failed to create bookmark for \(url.path): \(error)")
    }
}
```

For read-only access on future launches, add `.securityScopeAllowOnlyReadAccess`:
```swift
let bookmarkData = try url.bookmarkData(
    options: [.withSecurityScope, .securityScopeAllowOnlyReadAccess],
    includingResourceValuesForKeys: nil,
    relativeTo: nil
)
```

### Step 2: Store the Bookmark

Store bookmark data in a file inside your app's container. A property list or JSON file mapping identifiers to bookmark data works well.

```swift
private var bookmarkStorageURL: URL {
    FileManager.default
        .urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        .appendingPathComponent("Bookmarks.plist")
}
```

### Step 3: Resolve the Bookmark

On next launch, resolve the stored bookmark back to a URL.

```swift
func resolveBookmark() -> URL? {
    guard let bookmarkData = try? Data(contentsOf: bookmarkStorageURL) else {
        return nil
    }

    var isStale = false
    do {
        let url = try URL(
            resolvingBookmarkData: bookmarkData,
            options: .withSecurityScope,
            relativeTo: nil,
            bookmarkDataIsStale: &isStale
        )

        // CRITICAL: Refresh stale bookmarks immediately
        if isStale {
            logger.info("Bookmark is stale, recreating for \(url.path)")
            saveBookmark(for: url)
        }

        return url
    } catch {
        logger.error("Failed to resolve bookmark: \(error)")
        return nil
    }
}
```

### Step 4: Access the File

```swift
func readBookmarkedFile() -> Data? {
    guard let url = resolveBookmark() else { return nil }

    // MUST call start — resolved bookmarks do NOT auto-start access
    guard url.startAccessingSecurityScopedResource() else {
        logger.error("Failed to start security-scoped access for \(url.path)")
        return nil
    }

    // MUST call stop — use defer to guarantee it
    defer { url.stopAccessingSecurityScopedResource() }

    return try? Data(contentsOf: url)
}
```

### The Critical Difference

| Source | Access auto-started? | Must call start? | Must call stop? |
|--------|---------------------|-------------------|-----------------|
| NSOpenPanel / NSSavePanel | Yes | No | Yes |
| fileImporter / fileExporter | Yes | No | Yes |
| Dock drag-and-drop | Yes | No | Yes |
| Resolved security-scoped bookmark | No | Yes | Yes |

Every source requires `stopAccessingSecurityScopedResource()`. Resolved bookmarks additionally require `startAccessingSecurityScopedResource()`.

### Document-Relative Bookmarks

For project files that reference other files (like an IDE referencing source files), use document-relative bookmarks:

```swift
let bookmarkData = try sourceFileURL.bookmarkData(
    options: .withSecurityScope,
    includingResourceValuesForKeys: nil,
    relativeTo: projectDocumentURL  // The parent document
)
```

Any process with access to the parent document can resolve these bookmarks.

---

## Entitlements

### Core Sandbox Entitlement

`com.apple.security.app-sandbox` — Required for Mac App Store. Enables the sandbox. Without other entitlements, your app can only access its own container.

### File Access Entitlements

| Entitlement | Grants |
|-------------|--------|
| `com.apple.security.files.user-selected.read-only` | Read files the user picks via open panel |
| `com.apple.security.files.user-selected.read-write` | Read/write files the user picks |
| `com.apple.security.files.user-selected.executable` | Write executables to user-selected locations |
| `com.apple.security.files.downloads.read-only` | Read the Downloads folder |
| `com.apple.security.files.downloads.read-write` | Read/write the Downloads folder |
| `com.apple.security.files.pictures.read-only` | Read the Pictures folder |
| `com.apple.security.files.pictures.read-write` | Read/write the Pictures folder |
| `com.apple.security.files.music.read-only` | Read the Music folder |
| `com.apple.security.files.music.read-write` | Read/write the Music folder |
| `com.apple.security.files.movies.read-only` | Read the Movies folder |
| `com.apple.security.files.movies.read-write` | Read/write the Movies folder |
| `com.apple.security.files.all` | Access all files (rarely approved for App Store) |

### Network Entitlements

| Entitlement | Grants |
|-------------|--------|
| `com.apple.security.network.client` | Outgoing network connections |
| `com.apple.security.network.server` | Incoming network connections |

### Other Common Entitlements

| Entitlement | Grants |
|-------------|--------|
| `com.apple.security.device.camera` | Camera access |
| `com.apple.security.device.audio-input` | Microphone access |
| `com.apple.security.device.usb` | USB device access |
| `com.apple.security.print` | Printing |
| `com.apple.security.personal-information.addressbook` | Contacts |
| `com.apple.security.personal-information.calendars` | Calendar |
| `com.apple.security.personal-information.location` | Location services |
| `com.apple.security.application-groups` | Shared container between apps |

### Temporary Exception Entitlements

Temporary exceptions (`com.apple.security.temporary-exception.*`) grant broader access than standard entitlements. They exist for migrating legacy apps to the sandbox.

**What App Review expects**: Temporary exceptions require justification. Apple may reject apps that use them without a clear migration path toward removing them. If you're building a new app, avoid temporary exceptions entirely. Use standard entitlements and user-interaction-based file access instead.

### Principle of Least Privilege

Request only what you need. An app requesting `files.all` when it only opens user-selected documents will face App Review scrutiny. Start with the minimum (`files.user-selected.read-write`) and add entitlements only when a feature requires them.

---

## Diagnosing Sandbox Violations

### Step 1: Check Console.app

Open Console.app and apply these filters:
- **Subsystem**: `com.apple.sandbox.reporting`
- **Category**: `violation`
- **Type**: Error

This shows detailed violation reports including the process name, the denied operation, and a stack trace.

### Step 2: Check Xcode Debug Output

When running from Xcode with sandbox enabled, watch the Debug area for messages like:
```
Sandbox is preventing this process from reading networkd settings file
```

### Step 3: Use Quinn's Diagnostic Approach

Quinn "The Eskimo!" from Apple DTS recommends this flow for macOS access issues:

1. **Confirm the problem is actually the sandbox** — Other access controls (POSIX permissions, TCC/Privacy, Full Disk Access) can also deny operations. A sandbox violation always appears in Console with `com.apple.sandbox.reporting`.

2. **Check for missing entitlements** — Compare your entitlements file against what the operation requires.

3. **Check for stale bookmarks** — If accessing a previously bookmarked file, the bookmark may be stale (file moved/renamed). Check the `bookmarkDataIsStale` flag.

4. **Check the code signing identity** — macOS 14+ associates sandbox containers with code signatures. Different signatures (debug vs release, different teams) trigger permission prompts or denials.

### Common Violation Messages

| Message Pattern | Likely Cause | Fix |
|----------------|-------------|-----|
| `deny(1) file-read-data` | Reading file outside sandbox | Use open panel or add entitlement |
| `deny(1) file-write-data` | Writing file outside sandbox | Use save panel or add entitlement |
| `deny(1) network-outbound` | Outgoing network without entitlement | Add `network.client` entitlement |
| `deny(1) network-inbound` | Listening without entitlement | Add `network.server` entitlement |
| `deny(1) mach-lookup` | IPC with system service | May need temporary exception or redesign |

### Enable Verbose Logging

For deeper investigation:
```bash
log stream --predicate "subsystem == 'com.apple.sandbox.reporting'" --level debug
```

---

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Not testing in sandbox | Works in debug, crashes in release | Enable sandbox in debug OR test release/TestFlight builds |
| Not calling `stopAccessingSecurityScopedResource()` | File access stops working after many open/close cycles | Always use `defer` to balance every `start` with `stop` |
| Storing bookmarks in UserDefaults | Bookmark data lost or corrupted | Store in dedicated file in app container |
| Not checking `bookmarkDataIsStale` | Access fails after file is moved/renamed | Check flag and recreate bookmark when stale |
| Calling `startAccessing` on panel URLs | Wasted call (harmless but confusing) | Panel URLs have access auto-started; just call `stop` |
| Not calling `startAccessing` on resolved bookmarks | Access denied despite valid bookmark | Resolved bookmarks require explicit `startAccessing` |
| Hardcoding `~/Library/...` paths | Path denied in sandbox | Use `FileManager.urls(for:in:)` or container paths |
| Requesting `files.all` unnecessarily | App Review rejection | Use `files.user-selected.read-write` + bookmarks |
| Forgetting `network.client` entitlement | All network requests fail silently | Add outgoing connection entitlement |
| Different code signing in debug vs release | Container permission prompt on launch | Use consistent team ID; expect prompts during development |

---

## Resources

**WWDC**: 2022-10096, 2023-10053, 2024-10123

**Docs**: /security/app-sandbox, /security/accessing-files-from-the-macos-app-sandbox, /security/discovering-and-diagnosing-app-sandbox-violations, /xcode/configuring-the-macos-app-sandbox

**Forum Posts**: App Sandbox Resources (Quinn/DTS), Resolving Trusted Execution Problems, The Case for Sandboxing a Directly Distributed App

**Skills**: axiom-security, distribution (this suite)
