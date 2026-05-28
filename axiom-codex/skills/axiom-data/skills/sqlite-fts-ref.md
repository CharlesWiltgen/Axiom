# SQLite FTS5 Reference

## Overview

FTS5 is a SQLite virtual-table feature that provides full-text search over text columns. It is built into the SQLite library shipped with iOS and macOS, and is accessible from both GRDB (raw FTS5 plus the `FTS5Pattern` helper) and SQLiteData (`@Table` plus structured queries).

Most of FTS5 is identical across the two layers — schema declarations, tokenizers, external-content sync, Unicode normalization, ranking, prefix-index discipline, highlight and snippet, and maintenance commands. Only the Swift API surface differs.

**Core principle** FTS5 indexes the bytes you give it. The index makes no attempt to canonicalize Unicode, expand ligatures, or transliterate scripts. Normalize input before indexing AND apply the same normalization on every query, or accept silent match misses that are unrecoverable from logs alone.

This skill is the shared reference. Layer-specific API details cross-link to `grdb.md` and `sqlitedata-ref.md`.

## When to Use

Use this reference when:
- Adding search to an app backed by GRDB or SQLiteData
- Choosing a tokenizer (unicode61 vs porter vs trigram vs ascii)
- Diagnosing Unicode search misses ("café matches but Müller doesn't")
- Setting up an external-content FTS5 table to avoid duplicating content
- Tuning bm25 column weights so title matches outrank body matches
- Adding fast prefix or autocomplete search

If the question is purely about GRDB record types or SQLiteData query builder syntax, start in those skills first and return here for FTS5 specifics.

## Quick Decision Table

| Task | Section |
|---|---|
| Choose between FTS3 / FTS4 / FTS5 | §1 |
| Design the virtual table | §2 |
| Pick a tokenizer | §3 |
| Fix Unicode match misses | §4 |
| Keep an external-content index in sync | §5 |
| Order results by relevance | §6 |
| Make `MATCH 'abc*'` fast | §7 |
| Highlight matches or build snippets | §8 |
| Run optimize / rebuild / integrity-check | §9 |
| Wire up FTS5 from GRDB | §10 |
| Wire up FTS5 from SQLiteData | §11 |
| See it all wired together | §12 |
| Audit FTS5 code for known footguns | §13 |

## 1 — Pick FTS5

Pick FTS5 for all new code. SQLite calls it "the newest version of the SQLite [full-text search] module" and it supersedes FTS3 and FTS4 on every axis that matters for an app: better ranking (bm25 by default, no need to load a custom ranking function), the trigram tokenizer for substring search, richer auxiliary functions (`highlight`, `snippet`), tighter on-disk format, and the external-content table pattern that lets you index without duplicating storage.

FTS4's one feature absent from FTS5 is content compression — almost never worth picking FTS4 for. FTS3 is legacy; do not pick it for new code. FTS5 has been the default in iOS-bundled SQLite for years.

GRDB and SQLiteData both target FTS5 as the default. Anywhere this reference says "FTS table" assume FTS5.

## 2 — Schema patterns

FTS5 virtual tables come in three shapes. The shape determines storage cost and how you keep the index in sync with your data.

#### Contentful (default)

The FTS table stores the indexed text itself. Simplest to use, highest storage cost — text is held twice if you also have a source table.

```sql
CREATE VIRTUAL TABLE book USING fts5(title, body);
```

You `INSERT`, `UPDATE`, and `DELETE` against the FTS table directly. Use this when search is the primary access pattern and the FTS table can serve as the canonical store, or when the duplicate storage is acceptable.

#### External-content

The FTS table holds the index only; text lives in a normal table you already have. Lowest storage cost when you already store the rows elsewhere, but you must keep the two in sync (see §5).

```sql
CREATE VIRTUAL TABLE book_ft USING fts5(
    title, body,
    content='book',
    content_rowid='id'
);
```

`content` names the source table; `content_rowid` names the column in the source table that acts as the FTS rowid. Both columns referenced by the FTS table (`title`, `body` above) must exist on the source table with matching names.

#### Contentless

The FTS table stores neither the text nor a reference to a source. Smallest on disk, most limited at query time.

```sql
CREATE VIRTUAL TABLE log_ft USING fts5(message, content='');
```

Limitations: no `UPDATE`, no row-level `DELETE` (use the `delete` command instead — see §9), and reading non-rowid columns returns `NULL`. Use when you only need "does this row match?" answers and you have the row text elsewhere — for example, log search where the row is identified by rowid and the full message is fetched from another store.

#### Important: no types or constraints

SQLite is explicit: "It is an error to add types, constraints or PRIMARY KEY declarations" to FTS5 column definitions. Every column is TEXT, every column is nullable, there are no defaults, no `NOT NULL`, no `CHECK`. Treat the column list as names only.

## 3 — Tokenizers

The tokenizer decides how text is split into terms and how those terms are folded. Pick once, at table-creation time — changing later means rebuilding the index.

| Tokenizer | Behavior | Use when |
|---|---|---|
| `unicode61` | Default. Splits on Unicode word boundaries, lowercases, strips diacritics. "café" tokenizes the same as "cafe". | General multilingual text. The right default for almost every app. |
| `porter` | Wraps another tokenizer (unicode61 by default), then applies the Porter stemmer. "running" matches "runs", "ran". | English-only content. SQLite is explicit: the Porter stemmer is "designed for use with English language terms only" — do not use on mixed-language data. |
| `trigram` | Indexes every 3-character substring. Supports `LIKE '%foo%'`-style substring search and case-insensitive `MATCH` against arbitrary substrings. Optional `case_sensitive 1`. | Substring search, identifiers, codes, names. Larger index. |
| `ascii` | Like unicode61 but ASCII-only. No Unicode folding. | English-only, ASCII-only content where you want predictable behavior and the smallest tokenizer cost. |

The default unicode61 already strips diacritics, so "café" matching "cafe" is built in. What unicode61 does **not** do is canonicalize Unicode equivalents (NFC vs NFD), normalize compatibility forms (ligatures), or transliterate between scripts. That's §4.

#### Tokenizer options

unicode61 accepts options at table-creation time. The two worth knowing:

- `remove_diacritics='2'` — explicit version of the default behavior, plus full Unicode 6.1 decomposition coverage. `'1'` is the older limited form; `'0'` keeps diacritics. Stick with `'2'` for new code.
- `separators=':/@'` — extra characters treated as word separators. Useful for indexing URLs, emails, or paths so "foo@bar.com" tokenizes as `foo`, `bar`, `com`.
- `tokenchars='_-'` — extra characters kept as part of tokens. Inverse of `separators`. Useful for identifiers like `user_name` or `feature-flag`.

trigram accepts `case_sensitive`: `0` (default, case-insensitive) or `1` (case-sensitive). Pick `1` only when you genuinely need case-sensitive substring search — almost never the right answer for user-facing search.

GRDB's `t.tokenizer = .unicode61(...)` and `.trigram(...)` factories accept these options as Swift parameters; see the FTS5 source comments in GRDB for the parameter names.

## 4 — Unicode discipline [load-bearing]

This is the load-bearing section. Three traps cause silent FTS5 match misses on Apple platforms, and none are fixed by switching tokenizers. The fix is normalization, applied identically on both indexing and querying.

#### Trap 1: NFC vs NFD

`String` literals in Swift source and most user input from iOS keyboards arrive in NFC (precomposed). But filenames from HFS+ historically used NFD (decomposed), and JSON or other text coming over the network can be either. "é" can be one code point (U+00E9, NFC) or two (U+0065 U+0301, NFD). The two look identical, render identically, compare equal under Swift's `==` — and FTS5 sees two different byte sequences.

Result: you index NFC text, the user pastes an NFD string, and `MATCH` returns no rows. There is no error.

Fix: normalize to NFC before indexing AND before every query.

```swift
let normalized = userInput.precomposedStringWithCanonicalMapping
// Index this. Search with this.
```

#### Trap 2: Compatibility forms (ligatures, fullwidth, superscripts)

NFC does not collapse compatibility-equivalent characters. The ligature "ﬁ" (U+FB01) is one code point; "fi" is two. They look almost identical in many fonts. NFC keeps them distinct. NFKC merges them.

Result: PDF-extracted text often uses ligatures; user input does not. Index says "ﬁsh"; query says "fish"; no match.

Fix: normalize to NFKC when your input may contain compatibility characters.

```swift
let normalized = userInput.precomposedStringWithCompatibilityMapping
// NFKC: collapses ﬁ → fi, ３ → 3, etc.
```

NFKC is stronger than NFC and is usually safe for search. It is *not* safe for round-tripping text back to display unchanged. Keep an unnormalized copy if you need the original.

#### Trap 3: Transliteration (Müller ↔ Mueller)

Neither NFC nor NFKC handles transliteration. unicode61 strips the diacritic — "Müller" tokenizes as "muller" — but it does not expand to "mueller". German users routinely spell their own name either way. Same problem for "ø/o", "æ/ae", Latin spellings of Cyrillic and Greek names, and so on.

Fix: apply a transliteration transform alongside diacritic folding. `String.applyingTransform(_:reverse:)` is the Foundation API.

```swift
let folded = userInput
    .precomposedStringWithCanonicalMapping
    .applyingTransform(.stripDiacritics, reverse: false) ?? userInput
// "Müller" → "Muller". You still need a German-specific
// "ü → ue" map for true transliteration; .stripDiacritics
// is the canonical-fold step.
```

For language-specific transliteration (ü → ue, ß → ss, å → aa), maintain a small replacement table and apply it after `.stripDiacritics`. Apply the same table on indexing and querying.

`String.applyingTransform` also accepts ICU transform identifiers as `StringTransform` values — `.toLatin` transliterates many non-Latin scripts to Latin (`"Москва"` → `"Moskva"`), `.latinToArabic` and friends go the other way. For a multilingual search box that should accept "Moskva" and find a row stored as "Москва", chain `.toLatin` before diacritic strip on both sides. The transform is lossy; keep an unnormalized copy of the original text in the source table for display.

#### The rule

Apply the same normalization pipeline on indexing AND on querying. Mismatched normalization is a silent match miss — no error, no log, no symptom except a confused user typing the same word that's right there in the row.

The cost of this rule is one extension method and two call sites. The cost of skipping it is a slow trickle of "search is broken" reports that you cannot reproduce because your test data is all ASCII, your dev keyboard produces NFC, and the failing input came from a paste, an import, or a Cyrillic-to-Latin transliteration you didn't know happened.

A typical pipeline for a multilingual app:

```swift
extension String {
    var fts5Normalized: String {
        self.precomposedStringWithCompatibilityMapping  // NFKC
            .applyingTransform(.stripDiacritics, reverse: false) ?? self
    }
}

// At index time:
try db.execute(sql: "INSERT INTO book_ft (rowid, title, body) VALUES (?, ?, ?)",
               arguments: [id, title.fts5Normalized, body.fts5Normalized])

// At query time:
guard let pattern = FTS5Pattern(matchingAnyTokenIn: userInput.fts5Normalized) else {
    return []   // input produced no usable tokens
}
```

#### Anti-pattern: switching tokenizer to fix Unicode misses

"I added Unicode search but `café` matches and `Müller` doesn't. Should I switch to trigram?"

No. Trigram solves substring matching, not Unicode equivalence — it indexes byte trigrams, so "Müller" still does not match "Mueller". porter is English-only and makes the problem worse. ascii drops Unicode entirely. Switching tokenizer is the wrong axis.

The fix is always: pick the right normalization (NFKC + diacritic strip + language-specific replacements), apply it on both sides. Don't skip Unicode normalization — silent match misses are unrecoverable from logs alone, because there are no logs.

## 5 — External-content sync

External-content tables (§2) store only the index, not the text. The FTS table does not auto-update when you change the source table. SQLite spells this out: "It is still the responsibility of the user to ensure that the contents of an external content FTS5 table are kept up to date" — and an inconsistent index produces "unintuitive and inconsistent" query results.

Two strategies, often combined:

#### Strategy 1: triggers

Mirror every write to the source table into the FTS table.

```sql
CREATE TRIGGER book_ai AFTER INSERT ON book BEGIN
    INSERT INTO book_ft(rowid, title, body)
        VALUES (new.id, new.title, new.body);
END;

CREATE TRIGGER book_ad AFTER DELETE ON book BEGIN
    INSERT INTO book_ft(book_ft, rowid, title, body)
        VALUES ('delete', old.id, old.title, old.body);
END;

CREATE TRIGGER book_au AFTER UPDATE ON book BEGIN
    INSERT INTO book_ft(book_ft, rowid, title, body)
        VALUES ('delete', old.id, old.title, old.body);
    INSERT INTO book_ft(rowid, title, body)
        VALUES (new.id, new.title, new.body);
END;
```

For external-content tables, the `delete` command (not `DELETE FROM`) removes a row from the index and requires you to supply the old column values so FTS5 can locate the indexed terms.

Apply your normalization (§4) inside the trigger if your source columns hold the original text, or normalize once at the application layer and store the normalized form in the source table.

#### Strategy 2: rebuild

After a batch import or migration, drop the index contents and rebuild from the source table.

**Cross-process gotcha:** sync triggers only fire for writes from the connection that has them registered. If two processes both write to the source table (rare but real with App Groups), only the process whose connection registered the triggers will sync the FTS index. See `grdb-app-groups.md` §2 for the multi-process implication.

```sql
INSERT INTO book_ft(book_ft) VALUES('rebuild');
```

Rebuild is slow on large tables but is the one-shot way to restore consistency after triggers were missing, source data was bulk-loaded, or normalization rules changed.

#### GRDB API: `t.synchronize(withTable:)` does it all

The idiomatic GRDB path replaces both the trigger SQL above and the `rebuild` command with a single in-closure call:

```swift
try db.create(virtualTable: "book_ft", using: FTS5()) { t in
    t.tokenizer = .unicode61()
    t.synchronize(withTable: "book")   // auto-creates AI/AD/AU triggers + initial rebuild
    t.column("title")
    t.column("body")
}
```

`synchronize(withTable:)` generates the AFTER INSERT / DELETE / UPDATE triggers shown above and runs `INSERT INTO ft(ft) VALUES('rebuild')` once to populate the index. The SQL in Strategy 1 is what GRDB writes when you call this — show that to a colleague auditing the schema, or write it by hand if you're using raw SQLite or SQLiteData. Re-running migrations replaces the triggers safely; the `rebuild` only runs on first creation.

## 6 — Ranking and relevance

FTS5 ships two built-in ranking knobs: the `rank` column and the `bm25` function.

#### `ORDER BY rank`

The cheapest ordering. `rank` is a hidden column that returns the bm25 score with default column weights. Faster than calling `bm25()` because the engine can stop reading rows once it has enough top-N results. Use this for the common case.

EXPLAIN QUERY PLAN works on FTS5 MATCH queries; see `grdb-performance.md` §5 for the workflow. Tuning index design (`grdb-performance.md` §6) also applies to columns you JOIN against the FTS rowid.

```sql
SELECT * FROM book_ft
WHERE book_ft MATCH ?
ORDER BY rank
LIMIT 50;
```

#### `ORDER BY bm25(table)`

Same score as `rank` but as a function call, so you can pass column weights.

```sql
SELECT * FROM book_ft
WHERE book_ft MATCH ?
ORDER BY bm25(book_ft, 10.0, 5.0, 1.0)
LIMIT 50;
```

Positional arguments after the table name are per-column weights, matching the column order in `CREATE VIRTUAL TABLE`. A weight of `10.0` on the first column (title) makes title matches outrank body matches roughly 10:1, all else equal.

**Lower bm25 = better match.** FTS5 returns negative scores; `ORDER BY` ascending puts the best matches first. Do not flip the sort — `ORDER BY bm25(t) DESC` is "worst matches first".

#### SwiftUI / list pattern

For a search results list, `ORDER BY rank LIMIT 50` is almost always the right shape. Paginate with `LIMIT ? OFFSET ?` only when the user explicitly requests more — bm25 ranking quality drops off sharply past the first page or two, and users rarely scroll that far.

## 7 — Prefix search

`MATCH 'abc*'` matches any term beginning with "abc". By default this is a slow operation: FTS5 has to scan the term index for every term in the matching range.

Pre-index the prefixes you need at table-creation time:

```sql
CREATE VIRTUAL TABLE book_ft USING fts5(
    title, body,
    prefix='2 3'
);
```

`prefix='2 3'` builds dedicated indexes for 2- and 3-character prefixes. `MATCH 'ab*'` and `MATCH 'abc*'` are now O(log n) lookups.

#### Cost

Each prefix length roughly doubles the size of the term-index portion of the FTS table on storage. Two prefix lengths (`'2 3'`) is the common choice for autocomplete; three (`'2 3 4'`) is justifiable when autocomplete UX shows results from the first keystroke. Don't add prefix indexes you won't use.

#### Pick lengths to match your UX

For an autocomplete that triggers after 2 characters, you need `prefix='2 3'` so both `'ab*'` and `'abc*'` are fast. If your UX requires 3 characters minimum, `prefix='3'` alone is enough.

## 8 — Highlight and snippet

Two auxiliary functions wrap matched terms with markup or build short excerpts. Both work on contentful and external-content tables; both fail on contentless tables (the function has nothing to read).

#### `highlight(table, col, open, close)`

Returns the column's text with every matched term wrapped in `open` / `close`.

```sql
SELECT highlight(book_ft, 1, '<b>', '</b>') AS title_hl,
       highlight(book_ft, 2, '<b>', '</b>') AS body_hl
FROM book_ft
WHERE book_ft MATCH ?
ORDER BY rank
LIMIT 20;
```

Column index is 0-based and refers to columns of the FTS table in declaration order.

#### `snippet(table, col, open, close, ellipsis, max_tokens)`

Returns a short excerpt centered on the matched terms, with markup around each match and the supplied `ellipsis` separating non-adjacent fragments. `max_tokens` must satisfy `0 < max_tokens < 64` per SQLite — the practical max is 63.

```sql
SELECT snippet(book_ft, 2, '<b>', '</b>', ' … ', 32) AS preview
FROM book_ft
WHERE book_ft MATCH ?
ORDER BY rank
LIMIT 20;
```

Combined query producing a title with highlights and a body excerpt:

```sql
SELECT rowid,
       highlight(book_ft, 0, '<b>', '</b>') AS title_hl,
       snippet(book_ft, 1, '<b>', '</b>', ' … ', 32) AS body_preview
FROM book_ft
WHERE book_ft MATCH ?
ORDER BY rank
LIMIT 20;
```

#### Display in SwiftUI

The output contains literal `<b>...</b>` markers. Parse to `AttributedString` (init with HTML or run a simple tag-to-style pass) before displaying, or pick markers your text view already understands (Markdown `**bold**` for `Text(.init(...))`).

## 9 — Maintenance

FTS5 exposes several commands as inserts into the table itself. Each is a one-shot operation, not a query.

```sql
-- Full merge of all index segments. Slow on large tables. Run during idle
-- periods after major content changes.
INSERT INTO book_ft(book_ft) VALUES('optimize');

-- Discard the index and rebuild from the source. Works on contentful and external-content tables; not valid on contentless.
-- Use after a bulk import or when triggers were missing.
INSERT INTO book_ft(book_ft) VALUES('rebuild');

-- Incremental merge. Cheap, can be scheduled per-write. The argument is
-- the maximum number of pages to merge in this call.
INSERT INTO book_ft(book_ft, rank) VALUES('merge', 100);

-- Verify the index is internally consistent. Returns an error on corruption.
INSERT INTO book_ft(book_ft) VALUES('integrity-check');
```

A typical maintenance schedule for an app:
- `merge` on a small budget after every batch of writes (cheap, keeps the index from fragmenting)
- `optimize` on app launch if the table has more than a few thousand rows and hasn't been optimized recently
- `rebuild` is a recovery tool — run after a migration changed normalization rules or after fixing missing triggers
- `integrity-check` if you suspect corruption; it does not fix anything, only reports

## 10 — Layer-specific API: GRDB

GRDB exposes FTS5 through `Database.create(virtualTable:using:)` with an `FTS5` configuration block.

#### Create the table

```swift
try db.create(virtualTable: "book_ft", using: FTS5()) { t in
    t.tokenizer = .unicode61()
    t.column("title")
    t.column("body")
}
```

For external-content with prefix indexes:

```swift
try db.create(virtualTable: "book_ft", using: FTS5()) { t in
    t.tokenizer = .unicode61()
    t.synchronize(withTable: "book")
    t.prefixes = [2, 3]    // Set<Int> despite the array literal
    t.column("title")
    t.column("body")
}
```

`synchronize(withTable:)` is the recommended API. If you need finer control (e.g., the source table has a different column set), `t.content = "book"` + `t.contentRowID = "id"` (note: `String?`, not `Column`) declares the relationship without generating triggers — you write them manually per §5.

#### Escape user input — always use `FTS5Pattern`

Raw FTS5 `MATCH` syntax is a small query language with operators (`AND`, `OR`, `NOT`, `*`, `"..."`, column filters). Passing user input directly into `MATCH ?` does two bad things: a stray `"` or operator becomes a syntax error, and a malicious or accidental query can return rows you didn't intend.

`FTS5Pattern` converts a Swift string into a safe pattern string. The named initializers are **failable** (`init?`), not throwing — they return `nil` when the input produces no usable tokens after tokenization.

```swift
// Phrase: match the exact sequence of tokens
guard let phrasePattern = FTS5Pattern(matchingPhrase: userInput.fts5Normalized) else { return [] }

// Any token: OR together the tokens of the input
guard let anyPattern = FTS5Pattern(matchingAnyTokenIn: userInput.fts5Normalized) else { return [] }

// All tokens: AND together (the typical "search" semantics)
guard let allPattern = FTS5Pattern(matchingAllTokensIn: userInput.fts5Normalized) else { return [] }

// Prefix: AND together with the last token as a prefix (autocomplete)
guard let prefixPattern = FTS5Pattern(matchingAllPrefixesIn: userInput.fts5Normalized) else { return [] }
```

Treat `nil` as "no results" rather than an error. The one *throwing* initializer is `init(rawPattern:allowedColumns:)` — use it only when you're constructing the raw FTS5 query language directly.

#### Query

```swift
let books = try Book.fetchAll(db, sql: """
    SELECT book.* FROM book
    JOIN book_ft ON book_ft.rowid = book.id
    WHERE book_ft MATCH ?
    ORDER BY rank
    LIMIT 50
    """, arguments: [pattern])
```

For record types and association patterns, see `grdb.md`. For observation of search results, `ValueObservation` over the join works as it does for any other query — reactive search results that update as the source table changes come for free once the join is in place.

#### Observation pitfall

`ValueObservation` re-runs on every write to any of the tables it reads. A `JOIN` against an external-content FTS table reads both the source and the FTS table; the observation fires on writes to either. That's usually what you want — search results update when content changes — but it means observing search across a hot-write table is more expensive than observing a plain query. Debounce the search string in the UI (typically 200–300ms), don't debounce inside `ValueObservation`.

## 11 — Layer-specific API: SQLiteData

SQLiteData declares FTS5 tables through `@Table` with FTS5 modifiers and queries them via the structured query builder. The Unicode discipline of §4 applies identically — SQLiteData does not normalize for you, and the same NFKC + transliteration pipeline must run on indexing and querying.

For the current `@Table` syntax, the FTS5 modifier name, and how `MATCH` is expressed in the query builder, see the FTS section of `sqlitedata-ref.md`. The query builder applies parameter binding for *values*, which protects against SQL injection in regular queries. It does **not** escape FTS5 *syntax* (operators `AND`/`OR`/`NOT`, `"`, `*`) — for user-typed search input passed to FTS5, sanitize operators or build a pattern string yourself before calling `.match(_:)`.

The maintenance commands of §9 are written as raw SQL even from SQLiteData (`db.execute(...)` or the equivalent escape hatch), because they are operations on the table, not queries.

#### CloudKit interaction

SQLiteData's CloudKit sync replicates the source table, not the FTS index. The FTS table is a derived structure and lives only on each device. After a CloudKit pull adds or updates rows in the source table, your sync triggers (§5) fire normally and keep the local FTS index consistent. On first sync into a fresh install, run `INSERT INTO ft(ft) VALUES('rebuild')` after the initial bulk import to populate the index without relying on triggers — bulk inserts during a sync can bypass them depending on how SQLiteData applies the changes. Schedule the rebuild from your sync engine completion callback.

## 12 — Worked example: multilingual book search

Pulling the pieces together. Suppose you have a `book` table with `id`, `title`, and `body`, and you want a search box that works across English, German, and titles with ligatures from a PDF importer.

#### Schema

```swift
try db.create(table: "book") { t in
    t.autoIncrementedPrimaryKey("id")
    t.column("title", .text).notNull()
    t.column("body", .text).notNull()
}

try db.create(virtualTable: "book_ft", using: FTS5()) { t in
    t.tokenizer = .unicode61()
    t.synchronize(withTable: "book")   // generates triggers + initial rebuild
    t.prefixes = [2, 3]   // for autocomplete
    t.column("title")
    t.column("body")
}
```

`synchronize(withTable:)` writes the AFTER INSERT/DELETE/UPDATE triggers shown in §5 — but those triggers mirror the *raw* source columns. To index the *normalized* form instead, store the normalized form in a shadow column on `book` and let `synchronize` pick it up, or skip `synchronize(withTable:)` and write hand-rolled triggers that normalize inline.

#### Normalization helper

One extension method, one rule.

```swift
extension String {
    /// NFKC + diacritic strip. Apply on index AND query.
    var fts5Normalized: String {
        self.precomposedStringWithCompatibilityMapping
            .applyingTransform(.stripDiacritics, reverse: false) ?? self
    }
}
```

#### Write path

```swift
try db.write { db in
    try db.execute(sql: "INSERT INTO book (title, body) VALUES (?, ?)",
                   arguments: [title, body])
    let id = db.lastInsertedRowID
    try db.execute(sql: "INSERT INTO book_ft (rowid, title, body) VALUES (?, ?, ?)",
                   arguments: [id, title.fts5Normalized, body.fts5Normalized])
}
```

If you use triggers (recommended), normalize in the trigger body too — or store the normalized form in shadow columns on `book` and have the trigger copy them across. Picking one or the other consistently matters more than which.

#### Query path

```swift
func search(_ userInput: String) throws -> [Book] {
    let normalized = userInput.fts5Normalized
    guard let pattern = FTS5Pattern(matchingAllPrefixesIn: normalized) else {
        return []
    }
    return try dbQueue.read { db in
        try Book.fetchAll(db, sql: """
            SELECT book.* FROM book
            JOIN book_ft ON book_ft.rowid = book.id
            WHERE book_ft MATCH ?
            ORDER BY rank
            LIMIT 50
            """, arguments: [pattern])
    }
}
```

`matchingAllPrefixesIn:` is the right pattern for autocomplete: every token in the input must match, and the last token is treated as a prefix. The combination with `prefixes = [2, 3]` makes "harr" find "Harry" without a full term scan.

#### What this prevents

- "café" matches "cafe" — handled by unicode61's default diacritic strip
- "ﬁsh" matches "fish" — handled by NFKC in `.fts5Normalized`
- NFD paste of "café" matches NFC stored "café" — handled by NFKC normalizing both to the same form
- Stray `"` or `*` in user input crashes or corrupts the query — handled by `FTS5Pattern`
- Autocomplete typing "harr" returns no results — handled by `prefixes = [2, 3]` plus `matchingAllPrefixesIn:`

What it still does not handle without language-specific work: "Mueller" matching "Müller" (German spelling variant), or "Moskva" matching "Москва" (Latin-to-Cyrillic). Add `String.applyingTransform(.toLatin, ...)` to `fts5Normalized` for the latter; for the former, maintain a German-specific replacement table.

## 13 — Anti-patterns

| Anti-pattern | Symptom | Fix | Section |
|---|---|---|---|
| Indexing original text but querying normalized text (or vice versa) | Silent match misses on Unicode strings; works in dev where everything is ASCII | Apply the same normalization pipeline on both index and query paths. Wrap in one extension method so there's one call site. | §4 |
| Using `porter` tokenizer on non-English content | Stemming returns nonsense; Spanish, German, Japanese all suffer | Use `unicode61`; only pick `porter` for English-only content. | §3 |
| Passing raw user input to `MATCH` without escaping | Crashes on `"` or `*` in the query; query injection; quoted phrases ignored | GRDB: always use `FTS5Pattern`. SQLiteData: parameter binding alone does NOT escape FTS5 syntax — sanitize operators or build an FTS5 pattern string before calling `.match(_:)`. | §10, §11 |
| External-content table with no triggers and no scheduled rebuild | Index drifts from source; results return rows that don't match, or miss rows that do | Use `t.synchronize(withTable:)`; or install triggers for INSERT/UPDATE/DELETE AND keep a `rebuild` command available for recovery. | §5 |
| Switching tokenizer to "fix" Unicode match misses | Already tried unicode61; switched to trigram; problem persists or shifts | The fix is normalization, not tokenizer. Apply NFKC + diacritic strip + transliteration on both sides. | §4 |
| Contentless FTS table, then surprise that UPDATE fails | "Cannot UPDATE a contentless fts5 table" errors at runtime | Pick the schema shape at design time. If you need UPDATE, use contentful or external-content. | §2 |
| `prefix='2 3 4 5'` on a small table | Index storage balloons with no measurable benefit | Pick the smallest set of prefix lengths your UX actually uses. Don't add prefix lengths "just in case". | §7 |
| `ORDER BY bm25(t) DESC` | Worst matches show first; users see junk results at top | Lower bm25 is better. Use `ORDER BY rank` (ascending is implicit) or `ORDER BY bm25(t)` ascending. | §6 |
| Skipping `optimize` on a long-lived index | Search gets slower over months; users notice; nobody knows why | Schedule `merge` after batch writes and `optimize` periodically. | §9 |
| Highlighting on a contentless table | `highlight()` returns empty or NULL | Use `highlight`/`snippet` only on contentful or external-content tables — they need the text. | §8 |

## Resources

**Docs**: sqlite.org/fts5, github.com/groue/GRDB.swift Documentation/FullTextSearch.md

**Skills**: grdb, grdb-performance, sqlitedata, sqlitedata-ref
