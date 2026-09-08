---
name: swift-sharing
description: Point-Free swift-sharing — @Shared/@SharedReader, appStorage/fileStorage/inMemory strategies, loading and error state, custom SharedKey
skill_type: discipline
version: 1.0.0
---

# Sharing

Point-Free's [swift-sharing](https://github.com/pointfreeco/swift-sharing) gives one value a single storage location and many observers. It is the layer SQLiteData's `@FetchAll` and `@FetchOne` are built on, and it works on its own for user defaults, files, and in-memory state.

## When to Use

Use this skill when:

- A value is read in several places and must stay in sync — user settings, feature flags, the signed-in user
- You want to persist to `UserDefaults` or a file without hand-writing the load, save, and observe loop
- You need to know why `@FetchAll` is empty — still loading, or failed
- You are writing a custom persistence strategy, such as Keychain-backed or remote-config-backed storage
- A build broke after upgrading Xcode with an error about a `@Shared` setter

## Example Prompts

- "How do I persist a setting to UserDefaults and observe it from several views?"
- "My `@FetchAll` is empty. Is it still loading or did the query fail?"
- "I'm getting a compile error assigning to `$settings.isEnabled` after upgrading Xcode. What changed?"
- "How do I store an auth token with `@Shared` but keep it in the Keychain?"
- "How do I stop my tests from writing to the real UserDefaults?"

## What This Skill Provides

- `@Shared` versus `@SharedReader`, and how to derive narrower references from either
- The three built-in strategies — `.appStorage`, `.fileStorage`, `.inMemory` — and their traps, including the key-format rule that degrades cross-process observation (with a runtime warning) and the single-suite-instance rule
- Mutation through `withLock` and `Binding($shared)`, and the Swift 6.3 change that turned the old setter path into a compile error below Sharing 2.8.0
- Loading and error state: `isLoading`, `loadError`, `saveError`
- Dynamic keys — swapping the backing key at runtime to re-drive a search
- Writing a custom `SharedKey` / `SharedReaderKey`, including continuation rules
- Per-test storage quarantine and the UI-test entry-point setup
- Package traits (`CustomDump`, `IdentifiedCollections`, `CasePaths`) and the Swift 6.1 manifest requirement

## Documentation Scope

This page documents the swift-sharing material in the `axiom-data` skill — the patterns Claude draws on when a value has to persist and stay in sync across your app.

- For the database layer built on top of it, see [SQLiteData](/skills/persistence/sqlitedata)
- For storing secrets rather than preferences, see [Keychain](/skills/security/keychain)

## Related

- [SQLiteData](/skills/persistence/sqlitedata) – `@FetchAll` and `@FetchOne` wrap a Sharing `SharedReader`, so the loading and error APIs documented here apply to every SQLiteData fetch
- [SQLiteData Reference](/reference/sqlitedata-ref) – advanced query composition on top of those property wrappers
- [Keychain](/skills/security/keychain) – where secrets belong; reach them from `@Shared` through a custom key, never `.appStorage`

## Resources

**Docs**: github.com/pointfreeco/swift-sharing, github.com/pointfreeco/sqlite-data

**Skills**: sqlitedata, sqlitedata-ref
