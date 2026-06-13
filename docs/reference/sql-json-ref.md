---
name: sql-json-ref
description: SQLite JSON reference shared by GRDB and SQLiteData — JSON1 functions, the -> / ->> operators, JSONB, generated-column indexing, and the storage decision
skill_type: reference
version: 1.0.0
---

# SQLite JSON Reference

JSON-in-SQLite reference for both GRDB and SQLiteData. JSON1 functions, the `->`/`->>` operators, and the JSONB binary format are SQLite *engine* features — function names, path syntax, and the TEXT-vs-BLOB tradeoff apply identically across both layers. Only the Swift API surface differs.

This is storage-side JSON (a value living inside a column). For wire-format Codable — encoding a type for the network or a file — see [codable](/skills/persistence/codable). Different problem.

## When to Use This Reference

Use this reference when you're:

- Storing a Codable struct, array, or dictionary in a single SQLite column
- Extracting or filtering on a field inside a JSON column (`json_extract`, `->>`)
- Deciding between a TEXT JSON column, a JSONB BLOB, a real column, or a child table
- Making a JSON field fast to query (generated column + index)
- Reshaping JSON in a migration (rename a key, extract a field to its own column)
- Choosing JSONB and needing the iOS version floor

**For GRDB record types and migrations**: see [grdb](/skills/persistence/grdb).

**For SQLiteData query-builder syntax**: see [sqlitedata-ref](/reference/sqlitedata-ref).

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I store a Codable array in a SQLite column with GRDB / SQLiteData?"
- "Why is my `WHERE json_extract(data, '$.status') = 'active'` so slow?"
- "How do I index a field inside a JSON column?"
- "Should I use TEXT JSON or JSONB? What iOS version do I need for JSONB?"
- "How do I rename a key inside a JSON column across every row?"
- "What's the difference between `->` and `->>` in SQLite?"
- "When should I use a JSON column versus a child table?"

## What's Covered

### Version Floor
- JSON1 + `->`/`->>` → SQLite 3.38 (iOS 16+); JSONB → SQLite 3.45 (iOS 18+)
- iOS 26 / macOS 26 ship SQLite 3.51 — the whole surface is available on Axiom's iOS 18+ floor
- The system-vs-vendored SQLite caveat (SQLCipher / custom builds)

### JSON1 Functions and Operators
- Extract: `json_extract`, `->` (JSON), `->>` (SQL scalar)
- Inspect: `json_type`, `json_array_length`, `json_valid`
- Iterate: `json_each` (one level), `json_tree` (recursive)
- Modify: `json_set`, `json_insert`, `json_replace`, `json_remove`, `json_patch`
- Build: `json_object`, `json_array`, `json_group_array`, `json_group_object`

### JSONB (Binary Format)
- `jsonb()` / `jsonb_extract()` family; round-trip via `json()` for display
- TEXT vs JSONB decision — default TEXT; switch only when profiling shows parse cost

### Indexing JSON (Load-Bearing)
- A JSON extract in `WHERE` is a full scan — generated column + index is the fix
- STORED vs VIRTUAL; expression-index alternative

### Storage Decision
- Real column vs TEXT JSON vs JSONB vs child table
- When JSON is the wrong answer (filtering, one-to-many, FK integrity, concurrent partial updates)

### Layer-Specific APIs
- SQLiteData: `@Column(as: [T].JSONRepresentation.self)`, structured builders, `jsonGroupArray`/`jsonObject`
- GRDB: nested Codable → JSON text automatically, `databaseJSONEncoder/Decoder` (set `sortedKeys`), `JSONColumn`, the `Database.json*` functions, JSONB since GRDB 7

### Migration Patterns
- Rename a key, merge defaults (`json_patch`), promote a hot JSON field to a real indexed column, backfill safely

## Key Pattern

### Promote a hot JSON field to an indexable column

```sql
-- WHERE data ->> '$.status' = ? scans every row. Surface the field, then index it:
ALTER TABLE event ADD COLUMN status TEXT
    AS (data ->> '$.status') STORED;
CREATE INDEX event_status ON event(status);
SELECT * FROM event WHERE status = 'active';   -- now uses the index
```

### SQLiteData — store a Codable value as JSON

```swift
@Table struct Player {
    let id: UUID
    @Column(as: [String].JSONRepresentation.self)
    var achievements: [String]            // stored as JSON text
}
```

### GRDB — query a JSON column, with stable observation

```swift
let address = JSONColumn("address")
let players = try Player.filter(address["country"] == "FR").fetchAll(db)  // address ->> 'country' = 'FR'

extension Player {
    static func databaseJSONEncoder(for column: String) -> JSONEncoder {
        let e = JSONEncoder()
        e.outputFormatting = .sortedKeys      // required so ValueObservation detects real changes
        return e
    }
}
```

## Documentation Scope

This page documents the `sql-json-ref` shared reference. JSON1/JSONB function names, path syntax, the storage decision, and generated-column indexing apply identically to GRDB and SQLiteData users. Only the Swift API surface differs by layer.

## Related

- [grdb](/skills/persistence/grdb) – GRDB record types; nested Codable is stored as JSON automatically
- [grdb-performance](/skills/persistence/grdb-performance) – EXPLAIN QUERY PLAN confirms whether a JSON query hits an index
- [sqlitedata](/skills/persistence/sqlitedata) – SQLiteData `@Table` and `@Column(as:)` patterns
- [sqlitedata-ref](/reference/sqlitedata-ref) – SQLiteData advanced queries (JSON aggregation section)
- [sqlite-fts-ref](/reference/sqlite-fts-ref) – when a searched JSON array should be FTS5 or a child table instead
- [database-migration](/skills/persistence/database-migration) – safety rules for the reshape/backfill migrations above
- [codable](/skills/persistence/codable) – wire-format Codable (encoding for network/files), distinct from column storage
- [grdb-performance-auditor](/agents/grdb-performance-auditor) – automated scan that flags unindexed query patterns

## Resources

**SQLite docs**: sqlite.org/json1.html

**GRDB docs**: github.com/groue/GRDB.swift Documentation.docc/JSON.md

**SQLiteData docs**: swiftpackageindex.com/pointfreeco/swift-structured-queries
