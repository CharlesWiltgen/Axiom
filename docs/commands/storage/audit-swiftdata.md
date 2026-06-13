---
name: audit-swiftdata
description: Scan for SwiftData @Model bugs — struct models, missing VersionedSchema, relationship defaults, N+1 queries
---

# audit-swiftdata

Scan SwiftData code for `@Model` correctness, migration safety, and query patterns that cause silent data loss or runtime crashes.

## What This Command Does

Launches the **swiftdata-auditor** agent to catch the most common SwiftData mistakes — model definitions that won't persist correctly, migrations that lose data, and queries that fan out to N+1 fetches.

## What It Checks

1. **@Model on struct** – `@Model` requires a `class`; structs compile but never persist
2. **Missing VersionedSchema** – production schemas without versioning, blocking safe migrations
3. **Relationship defaults** – `@Relationship` properties without explicit `deleteRule` or `inverse`, causing leaks or orphans
4. **Migration timing** – schema changes shipped without a `MigrationPlan`, risking data loss on upgrade
5. **N+1 query patterns** – fetching a parent then iterating to load children one-by-one

## Related Agent

- [swiftdata-auditor](/agents/swiftdata-auditor) – The agent that powers this command
