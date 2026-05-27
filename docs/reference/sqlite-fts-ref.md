---
name: sqlite-fts-ref
description: SQLite FTS5 reference shared by GRDB and SQLiteData — tokenizers, Unicode normalization, external-content sync, ranking, prefix indexes, the MATCH operator
skill_type: reference
version: 1.0.0
---

# SQLite FTS5 Reference

Full-text search reference for both GRDB and SQLiteData. FTS5 is a SQLite virtual-table feature; tokenizer choice, external-content sync, Unicode normalization, ranking, and prefix-index discipline apply identically across both layers. Only the Swift API surface differs.

## When to Use This Reference

Use this reference when you're:

- Adding search to a GRDB- or SQLiteData-backed app
- Choosing a tokenizer (unicode61 / porter / trigram / ascii)
- Diagnosing Unicode search misses ("café matches but Müller doesn't")
- Setting up an external-content FTS5 table to avoid duplicating storage
- Tuning bm25 column weights so title matches outrank body matches
- Adding fast prefix or autocomplete search
- Wiring up `highlight()` and `snippet()` for result UI

**For GRDB record types and migrations**: see [grdb](/skills/persistence/grdb).

**For SQLiteData-specific query builder syntax**: see [sqlitedata-ref](/reference/sqlitedata-ref).

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "Add full-text search to my GRDB app"
- "Why doesn't `Müller` match `Mueller` in my FTS5 search?"
- "How do I keep an external-content FTS5 index in sync with my source table?"
- "What's the difference between unicode61, porter, and trigram tokenizers?"
- "How do I rank search results so title matches outrank body matches?"
- "Why are my prefix searches slow? Should I add `prefix='2 3'`?"
- "How do I escape user input safely for an FTS5 MATCH query?"
- "Should I use contentful, external-content, or contentless FTS5?"

## What's Covered

### Schema Patterns
- Contentful (default), external-content, contentless
- When to pick each shape
- `t.synchronize(withTable:)` — the idiomatic GRDB API

### Tokenizers
- `unicode61` (default, multilingual, strips diacritics)
- `porter` (English stemming only)
- `trigram` (substring/LIKE-style matching)
- `ascii` (ASCII-only)
- Tokenizer options (`remove_diacritics`, `separators`, `tokenchars`)

### Unicode Discipline (Load-Bearing)
- NFC vs NFD — silent match misses on equivalent visible strings
- Ligature equivalence ("ﬁ" U+FB01 ↔ "fi") via NFKC
- Language-specific transliteration ("Müller" ↔ "Mueller")
- The rule: apply normalization identically on indexing AND querying

### External-Content Sync
- Triggers (AFTER INSERT/UPDATE/DELETE)
- `rebuild` command after batch operations
- Cross-process gotchas for app-group databases

### Ranking & Relevance
- `ORDER BY rank` (cheap, default)
- `bm25(table, w1, w2, ...)` column weights
- Lower bm25 = better match (do NOT use `.desc()`)

### Prefix Search
- `prefix='2 3'` table option pre-indexes prefixes
- Storage cost tradeoffs

### Highlight & Snippet
- `highlight(t, col, '<b>', '</b>')`
- `snippet(t, col, '<b>', '</b>', '...', 32)` (max_tokens must be < 64)

### Maintenance Commands
- `optimize`, `rebuild`, `merge`, `integrity-check`

### Layer-Specific APIs
- GRDB: `try db.create(virtualTable:using:FTS5())`, `FTS5Pattern`
- SQLiteData: `@Table` with FTS5 modifiers (cross-link to sqlitedata-ref)

## Key Pattern

### GRDB external-content FTS5 with prefix indexes

```swift
try db.create(virtualTable: "book_ft", using: FTS5()) { t in
    t.tokenizer = .unicode61()
    t.synchronize(withTable: "book")   // auto-creates triggers + initial rebuild
    t.prefixes = [2, 3]
    t.column("title")
    t.column("body")
}
```

### Unicode normalization helper

```swift
extension String {
    var fts5Normalized: String {
        precomposedStringWithCompatibilityMapping              // NFKC (ligatures)
            .applyingGermanFolds()                              // language-specific: ü→ue, ß→ss
            .applyingTransform(.stripDiacritics, reverse: false) ?? self
    }
}

// Apply on indexing AND querying — identical pipeline
let normalized = userInput.fts5Normalized
guard let pattern = FTS5Pattern(matchingAllPrefixesIn: normalized) else { return [] }
```

### Ranking with column weights

```swift
let results = try Book.fetchAll(db, sql: """
    SELECT book.* FROM book
    JOIN book_ft ON book_ft.rowid = book.id
    WHERE book_ft MATCH ?
    ORDER BY bm25(book_ft, 10.0, 5.0, 1.0)
    LIMIT 50
    """, arguments: [pattern])
// Title (col 1) weighted 10×, body (col 2) 5×, third column 1×
// Lower bm25 = better, so default ascending order is correct
```

## Documentation Scope

This page documents the `sqlite-fts-ref` shared reference. Tokenizer choice, Unicode discipline, ranking, and prefix indexes apply identically to GRDB and SQLiteData users. Only the Swift API surface differs by layer.

## Related

- [grdb](/skills/persistence/grdb) — GRDB record types and queries
- [grdb-performance](/skills/persistence/grdb-performance) — EXPLAIN QUERY PLAN works on FTS5 MATCH queries
- [sqlitedata](/skills/persistence/sqlitedata) — SQLiteData `@Table` patterns
- [sqlitedata-ref](/reference/sqlitedata-ref) — SQLiteData advanced query patterns (FTS5 section)
- [grdb-app-groups](/skills/persistence/grdb-app-groups) — cross-process FTS5 trigger caveats
- [grdb-performance-auditor](/agents/grdb-performance-auditor) — automated scan that includes FTS5 anti-patterns

## Resources

**SQLite docs**: sqlite.org/fts5

**GRDB docs**: github.com/groue/GRDB.swift Documentation/FullTextSearch.md
