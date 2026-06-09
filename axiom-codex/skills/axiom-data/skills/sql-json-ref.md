# SQLite JSON Reference (JSON1 + JSONB)

## Overview

SQLite stores and queries JSON through the JSON1 function set (built into the SQLite library shipped with iOS and macOS) and, since 2024, the JSONB binary format. Both are SQLite *engine* features — the function names, path syntax, and the TEXT-vs-BLOB tradeoff are identical whether you reach them through SQLiteData, GRDB, or raw `#sql`. Only the Swift API surface differs.

This skill is the shared reference. Wire-format Codable (encoding a value for the network or a file) lives in `codable.md`; this skill is about storing JSON *inside a column* and querying it. Different problem.

**Core principle** A JSON column is opaque to the query planner. `WHERE json_extract(data, '$.status') = 'active'` reads and parses every row — no index can help until you surface the field as a generated column. Treat JSON as a convenience for whole-value read/write, not as a substitute for columns you filter, sort, or join on. The moment you query a field, either index it (§4) or it shouldn't be in JSON (§5).

## When to Use

Use this reference when:
- Storing a Codable struct, array, or dictionary in a single SQLite column
- Extracting or filtering on a field inside a JSON column (`json_extract`, `->>`)
- Deciding between a TEXT JSON column, a JSONB BLOB column, a real column, or a child table
- Making a JSON field fast to query (generated column + index)
- Reshaping JSON in a migration (rename a key, extract a field to its own column)
- Choosing JSONB and needing the iOS version floor

If the question is "how do I make my type Codable for an API payload," start in `codable.md`. If it's GRDB record types or SQLiteData query-builder syntax in general, start in `grdb.md` / `sqlitedata-ref.md` and return here for the JSON specifics.

## Quick Decision Table

| Task | Section |
|---|---|
| Confirm a JSON feature is available on my deployment target | §1 |
| Extract / inspect / iterate / modify / build JSON | §2 |
| Decide TEXT JSON vs JSONB BLOB | §3 |
| Make a JSON field filterable / sortable at scale | §4 |
| Decide JSON column vs real column vs child table | §5 |
| Wire JSON from SQLiteData | §6 |
| Wire JSON from GRDB | §7 |
| Reshape or extract JSON in a migration | §8 |
| Avoid the common traps | §9 |

## 1 — Version floor

JSON1 functions and the `->`/`->>` operators arrived in SQLite 3.38.0 and are built in by default (no compile flag). JSONB arrived in SQLite 3.45.0. The system SQLite that GRDB and SQLiteData link against is the one Apple ships with the OS, so feature availability tracks the OS version.

| Feature | SQLite | OS floor |
|---|---|---|
| `json_extract`, `json_set`, `json_each`, all JSON1 functions | 3.38 | iOS 16 / macOS 13 |
| `->` and `->>` path operators | 3.38 | iOS 16 / macOS 13 |
| JSONB binary format, `jsonb()` / `jsonb_extract()` family | 3.45 | iOS 18 / macOS 15 |

iOS 26 / macOS 26 ship SQLite 3.51. Axiom targets iOS 18+ / macOS 15+, so the entire JSON1 surface **and** JSONB are available everywhere you deploy — no runtime version checks needed. The only floor that bites: if you still support iOS 17, JSONB (§3) is unavailable there; the TEXT-JSON path (§2) works back to iOS 16.

> The floor is the *system* SQLite. A wrapper built against a vendored SQLite (e.g. GRDB-SQLCipher, or a custom static build) ships its own version — check that build's SQLite, not the OS table above.

## 2 — JSON1 functions and operators

JSON1 operates on JSON held as TEXT (or as a JSONB BLOB — §3). Paths use `$` for the document root, `.key` for object members, and `[n]` for array elements: `$.address.city`, `$.tags[0]`, `$[2].name`.

#### Extract

```sql
-- json_extract: scalar for a leaf, JSON text for an object/array
SELECT json_extract('{"a":{"b":42}}', '$.a.b');   -- 42 (integer)
SELECT json_extract('{"a":{"b":42}}', '$.a');      -- {"b":42} (text)

-- Operators (3.38+) — terser, and the planner treats them identically:
--   ->  yields JSON  (a quoted string stays quoted)
--   ->> yields a SQL scalar (text/number/null, unquoted)
SELECT data ->  '$.name' FROM t;   -- "Ada"   (JSON, quoted)
SELECT data ->> '$.name' FROM t;   -- Ada     (SQL text)
SELECT data ->> 'name'   FROM t;   -- a bare key is shorthand for '$.name'
```

Use `->>` for `WHERE` / `ORDER BY` / joins (you want the SQL scalar). Use `->` only when you want a JSON fragment back.

#### Inspect

```sql
json_type('{"a":1}', '$.a')      -- 'integer' | 'text' | 'real' | 'true' | 'false' | 'null' | 'object' | 'array'
json_array_length('[1,2,3]')     -- 3
json_valid(x)                    -- 1 if x parses as JSON, else 0  (use in a CHECK constraint)
```

#### Iterate — `json_each` / `json_tree`

`json_each` is a table-valued function: one row per immediate child. This is how you query *into* an array without exploding it into columns.

```sql
-- Rows whose tags array contains 'swift'
SELECT t.id
FROM   item t, json_each(t.tags) j
WHERE  j.value = 'swift';

-- Each row exposes: key, value, type, atom, id, parent, fullkey, path
```

`json_tree` recurses the whole document (every node at every depth); `json_each` is one level. Reach for `json_tree` only when the shape is genuinely arbitrary — it is much heavier.

#### Modify

These return a *new* JSON value; they never mutate in place. Persist with an `UPDATE ... SET col = json_set(col, ...)`.

```sql
json_set(data, '$.status', 'done')      -- create OR overwrite
json_insert(data, '$.status', 'done')   -- create only (no-op if present)
json_replace(data, '$.status', 'done')  -- overwrite only (no-op if absent)
json_remove(data, '$.tmp')              -- delete a path
json_patch(data, '{"a":1,"b":null}')    -- RFC 7396 merge; null deletes a key
```

#### Build

```sql
json_object('id', id, 'title', title)            -- one object per row
json_array(1, 2, 3)
json_group_array(title)                          -- aggregate rows -> JSON array
json_group_object(key, value)                    -- aggregate rows -> JSON object
```

## 3 — JSONB (binary format)

JSONB stores SQLite's parsed representation as a BLOB, skipping the re-parse that every TEXT-JSON function pays on every call. `jsonb_*` mirrors the JSON1 set (`jsonb_extract`, `jsonb_set`, `jsonb_insert`, …) but returns/consumes BLOBs.

```sql
SELECT typeof(jsonb('{"a":1}'));               -- 'blob'
SELECT jsonb_extract(jsonb('{"a":7}'), '$.a'); -- 7
SELECT json(data_b);                           -- BLOB -> readable TEXT for display/debug
```

JSONB is *not* human-readable and is not a stable wire format — it is an on-disk optimization, version-tied to SQLite. Round-trip through `json()` for display, logging, or export.

| | TEXT JSON | JSONB BLOB |
|---|---|---|
| Readable in a DB browser | yes | no (`json()` to read) |
| Repeated `*_extract` on the same column | re-parses each call | parsed once on write |
| Storage size | larger | ~5–10% smaller |
| Floor | iOS 16 | iOS 18 |

Default to **TEXT** — it is debuggable and the difference is invisible at small scale. Switch a column to **JSONB** only when profiling (`xcprof` / `EXPLAIN QUERY PLAN`) shows JSON parsing is a measured hot path, typically many extracts per row over a large table. Store one or the other consistently per column; `CHECK (json_valid(col, 0x08))` validates JSONB (the `0x08` flag is strict JSONB — plain `json_valid(col)` checks TEXT JSON).

## 4 — Indexing JSON [load-bearing]

A `json_extract` in a `WHERE` clause is a full table scan — the planner cannot see inside the blob. The fix is a **generated column** that surfaces the field, then a normal index on it.

```sql
ALTER TABLE event ADD COLUMN status TEXT
    AS (data ->> '$.status') STORED;     -- or VIRTUAL
CREATE INDEX event_status ON event(status);

-- Now this uses the index instead of scanning + parsing every row:
SELECT * FROM event WHERE status = 'active';
```

- **STORED** writes the value to disk (more space, no recompute on read) — prefer it for a column you index and read often.
- **VIRTUAL** recomputes on read (no extra space) — fine for an indexed column, since the *index* is materialized regardless.
- You can also index the expression directly — `CREATE INDEX e_status ON event(data ->> '$.status')` — but only a query using the *identical* expression hits it. A generated column is more discoverable and reusable. Prefer it.

If you index more than one or two fields of a JSON column, that is the signal they should be real columns (§5), not JSON.

## 5 — Storage decision

| Situation | Store as |
|---|---|
| You filter / sort / join on the field | a real column |
| Whole-value read/write; rarely query inside | TEXT JSON column |
| Same as above, large table, extract is a measured hot path | JSONB column (§3) |
| One row owns many of these, queried independently | a child table |
| A handful of JSON fields are queried hot | generated columns + index (§4) |

#### When JSON is the wrong answer

- **You filter on it.** `WHERE data ->> '$.x' = ?` scans every row. Promote to a column.
- **It is a one-to-many you query.** A `tags` array you search by tag wants a `tag` child table (and possibly FTS5 — see `sqlite-fts-ref.md`) so each tag is indexable.
- **You need referential integrity.** Foreign keys can't point into JSON.
- **Concurrent partial updates.** Two writers each `json_set` a different key read-modify-write the whole blob; last write wins and silently drops the other's change. Separate columns update independently.

JSON earns its place for genuinely schemaless, write-mostly payloads — a cached API response, per-row feature flags, a settings bag — where you read the whole value and rarely query a part.

## 6 — Layer-specific API: SQLiteData

SQLiteData stores a Swift value as JSON via the `JSONRepresentation` column type (from StructuredQueries). Any `Codable` property — array, dictionary, or nested struct — round-trips through a TEXT column.

```swift
@Table struct Player {
    let id: UUID
    var name: String
    @Column(as: [String].JSONRepresentation.self)
    var achievements: [String]            // stored as JSON text: ["gold","speedrun"]
    @Column(as: Loadout.JSONRepresentation.self)
    var loadout: Loadout                  // nested Codable struct as JSON
}
```

Query into the column with the structured builders, which emit `json_extract` / `->>`:

```swift
// Aggregate child rows into a JSON array (json_group_array under the hood)
let byStore = try Store.group(by: \.id)
    .leftJoin(Item.all) { $0.id.eq($1.storeID) }
    .select { ($0.name, $1.title.jsonGroupArray()) }
    .fetchAll(db)
```

`jsonGroupArray()` and `jsonObject(...)` are documented under Aggregation in `sqlitedata-ref.md`. For a field you filter on, add a generated column in the migration (§4) and query that column normally — don't extract in the `WHERE`.

**CloudKit note** A synchronized table sees the JSON column as one opaque field; a partial update ships the whole value. Keep independently-edited fields out of a shared JSON blob (§5, concurrent updates).

## 7 — Layer-specific API: GRDB

A nested `Codable` property on a record is stored as a JSON string automatically — no annotation needed.

```swift
struct Player: Codable, FetchableRecord, PersistableRecord {
    var id: Int64
    var name: String
    var achievements: [String]    // -> JSON text column automatically
    var loadout: Loadout          // nested Codable -> JSON text automatically
}
```

Customize the JSON coder per record. **Set `sortedKeys`** — GRDB's change tracking and `ValueObservation` compare encoded bytes, so unstable key order makes them miss or over-report changes:

```swift
extension Player {
    static func databaseJSONEncoder(for column: String) -> JSONEncoder {
        let e = JSONEncoder()
        e.outputFormatting = .sortedKeys      // required for stable observation
        return e
    }
}
```

Query JSON with `JSONColumn` and the `Database.json*` functions (the `->`/`->>` operators are available on `SQLJSONExpressible` conformers):

```swift
let address = JSONColumn("address")
let players = try Player
    .filter(address["country"] == "FR")          // address ->> 'country' = 'FR'
    .fetchAll(db)

// Function set: Database.jsonExtract(_:atPath:), .jsonArrayLength(_:),
// .jsonType(_:atPath:), .jsonPatch(_:with:), .jsonSet(_:_:), .jsonRemove(_:atPath:),
// .jsonGroupArray(_:filter:), .jsonGroupObject(key:value:filter:), .jsonIsValid(_:)
```

**JSONB** SQL support (the `jsonb_*` functions through GRDB's query interface) landed in **GRDB 7**; on an older GRDB you can still call them via raw SQL. As elsewhere, index a hot field with a generated column (§4) rather than filtering on an extract.

```swift
// Raw SQL escape hatch — always bind, never interpolate user input
let rows = try Row.fetchAll(db, sql: """
    SELECT id FROM event WHERE data ->> '$.status' = ?
    """, arguments: ["active"])
```

## 8 — Migration patterns

JSON migrations run inside the normal migrator (`DatabaseMigrator` for GRDB, the SQLiteData migration step) — see `database-migration.md` for the safety rules. The mutating functions return new values, so reshaping is a plain `UPDATE`.

```sql
-- Rename a key across every row
UPDATE event SET data = json_remove(json_set(data, '$.newName', data ->> '$.oldName'), '$.oldName');

-- Merge defaults into existing rows (RFC 7396; null would delete a key)
UPDATE settings SET data = json_patch('{"theme":"system","haptics":1}', data);

-- Promote a hot JSON field to a real, indexable column (the §5 fix)
ALTER TABLE event ADD COLUMN status TEXT;
UPDATE event SET status = data ->> '$.status';      -- backfill existing rows
CREATE INDEX event_status ON event(status);
-- (a STORED generated column does the backfill for you — §4 — but a plain
--  column lets you stop writing the field into JSON going forward)
```

Backfill in one `UPDATE` for small tables; batch by rowid range for large ones to bound the transaction (see `grdb-performance.md`). Guard a JSON column you rely on with `CHECK (json_valid(data))` so a bad write fails loudly instead of corrupting reads.

## 9 — Anti-patterns

| Anti-pattern | Why it hurts | Instead |
|---|---|---|
| `WHERE data ->> '$.x' = ?` on a large table | full scan + parse every row | generated column + index (§4) |
| Indexing many fields of one JSON column | the fields are really columns | promote them (§5) |
| JSON array you search by element | each element is unindexable | child table, or FTS5 |
| Concurrent `json_set` on different keys | read-modify-write of the whole blob; last write wins | separate columns |
| JSONB to "save space" by default | unreadable, ties data to SQLite version, gain is tiny | TEXT until profiling says otherwise |
| Foreign key "into" a JSON field | not enforceable | a real column with a real FK |
| Interpolating a user value into a JSON SQL string | injection | bind parameters (`?` / `#bind`) |
| Encoding JSON without `sortedKeys` (GRDB) | ValueObservation misses changes | set `.sortedKeys` (§7) |

## Resources

**Docs**: sqlite.org/json1.html, github.com/groue/GRDB.swift Documentation.docc/JSON.md, swiftpackageindex.com/pointfreeco/swift-structured-queries

**Skills**: sqlitedata-ref, grdb, grdb-performance, sqlite-fts-ref, database-migration, codable
