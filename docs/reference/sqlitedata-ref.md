---
name: sqlitedata-ref
description: SQLiteData advanced patterns, @Selection column groups, single-table inheritance, recursive CTEs, database views, custom aggregates, TableAlias self-joins, JSON/string aggregation
skill_type: reference
version: 1.0.0
---

# SQLiteData Advanced Reference

Advanced query patterns and schema composition for Point-Free's SQLiteData framework. Built on GRDB and StructuredQueries.

## When to Use This Reference

Use this reference when you're:
- Composing reusable column groups with `@Selection`
- Implementing single-table inheritance patterns
- Writing recursive CTEs for hierarchical data
- Creating database views for complex queries
- Building custom aggregate functions
- Using `TableAlias` for self-joins
- Aggregating data as JSON or concatenated strings

**For core patterns** (CRUD, CloudKit, @Table basics), see the [sqlitedata](/skills/persistence/sqlitedata) skill instead.

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I share timestamp columns across multiple SQLiteData tables?"
- "I need to query a tree structure in SQLiteData. How do I write a recursive CTE?"
- "How do I implement single-table inheritance with @Selection?"
- "I want to create a database view for a complex join. How?"
- "How do I aggregate child records as JSON in a single query?"
- "I need a self-join for comparing records in the same table."
- "How do I write a custom aggregate function in SQLiteData?"

## What's Covered

### Schema Composition
- `@Selection` for reusable column groups
- Embedding column groups in `@Table` types
- Single-table inheritance patterns
- Flattening groups in CREATE TABLE

### Advanced Queries
- Recursive CTEs for hierarchical data (trees, graphs)
- Database views with `@Selection`
- `TableAlias` for self-joins
- Complex predicates and joins

### Aggregation
- JSON aggregation (`jsonGroupArray`)
- String concatenation (`groupConcat`)
- Custom aggregate functions
- Grouping and filtering aggregates

### Performance Patterns
- Indexed queries
- Query plan analysis
- Batch operations

## Key Pattern

### Column Groups with @Selection

```swift
// Define reusable column group
@Selection
struct Timestamps {
    let createdAt: Date
    let updatedAt: Date?
}

// Embed in multiple tables
@Table
struct Reminder: Identifiable {
    let id: UUID
    var title = ""
    let timestamps: Timestamps  // Reused column group
}
```

**Note:** Flatten all groups in your CREATE TABLE—SQLite has no concept of grouped columns.

### Recursive CTE for Trees

```swift
// Query all descendants of a folder
let descendants = Folder
    .withRecursive(
        initial: Folder.filter(id: rootFolderId),
        recursive: { cte in
            Folder.joining(required: cte, on: \.parentId.eq(cte[\.id]))
        }
    )
```

## Documentation Scope

This reference covers advanced SQLiteData patterns for experienced developers. For basic CRUD operations, CloudKit sync setup, and `@Table` fundamentals, use the main [sqlitedata](/skills/persistence/sqlitedata) skill.

## Related

- [sqlitedata](/skills/persistence/sqlitedata) — Core patterns: CRUD, CloudKit, @Table basics
- [grdb](/skills/persistence/grdb) — Raw GRDB when you need maximum SQL control
- [database-migration](/skills/persistence/database-migration) — Safe schema evolution patterns
- [swift-concurrency](/skills/concurrency/swift-concurrency) — Swift 6 concurrency for database actors

## Resources

**WWDC**: N/A (third-party framework)

**Docs**: github.com/pointfreeco/sqlite-data, github.com/groue/GRDB.swift
