/**
 * Tests for scripts/audit-areas.ts.
 *
 * Run via `node --test scripts/audit-areas.test.ts`. Wired into predeploy
 * so every release gates on these passing.
 *
 * Hermetic — synthetic registries only, never the real audit-areas.json.
 * The real file is exercised by the round-trip check in
 * build-audit-areas.ts --check, which predeploy also runs.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  orderAreas,
  validateRegistry,
  renderArgumentList,
  renderBodyTable,
  renderDocsTables,
  expectedSidebarGroups,
  validateSidebarAgainstRegistry,
  spliceRegion,
  type AuditRegistry,
} from "./audit-areas.ts";

const registry: AuditRegistry = {
  groupOrder: ["Build", "Storage"],
  areas: [
    {
      area: "swiftdata",
      agent: "swiftdata-auditor",
      group: "Storage",
      detects: "@Model struct, VersionedSchema, relationship defaults",
      docsDetects: "@Model correctness, VersionedSchema, relationship defaults",
      docPath: "/commands/storage/audit-swiftdata",
    },
    {
      area: "build",
      agent: "build-optimizer",
      group: "Build",
      detects: "Build time optimization opportunities",
      docsDetects: "Build time optimization opportunities",
      docPath: "/commands/build/audit-build",
    },
    {
      area: "icloud",
      agent: "icloud-auditor",
      group: "Storage",
      detects: "iCloud integration issues, entitlements",
      docsDetects: "iCloud entitlements, file coordination, CloudKit errors",
      docPath: "/commands/storage/audit-icloud",
    },
  ],
};

describe("orderAreas", () => {
  it("sorts by group order, then alphabetically within group", () => {
    assert.deepEqual(orderAreas(registry).map((a) => a.area), [
      "build",
      "icloud",
      "swiftdata",
    ]);
  });

  it("does not mutate the registry", () => {
    const before = registry.areas.map((a) => a.area);
    orderAreas(registry);
    assert.deepEqual(registry.areas.map((a) => a.area), before);
  });
});

describe("validateRegistry", () => {
  it("accepts a well-formed registry", () => {
    assert.deepEqual(validateRegistry(registry), []);
  });

  it("rejects an area whose group is not in groupOrder", () => {
    const bad = { ...registry, areas: [{ ...registry.areas[0], group: "Ghost" }] };
    const errs = validateRegistry(bad);
    assert.equal(errs.filter((e) => /not in groupOrder/.test(e)).length, 1);
  });

  it("rejects a duplicate area", () => {
    const bad = { ...registry, areas: [...registry.areas, registry.areas[0]] };
    assert.ok(validateRegistry(bad).some((e) => /duplicate area 'swiftdata'/.test(e)));
  });

  it("rejects an empty required field", () => {
    const bad = { ...registry, areas: [{ ...registry.areas[0], detects: "  " }] };
    assert.ok(validateRegistry(bad).some((e) => /empty 'detects'/.test(e)));
  });

  it("rejects a pipe in description text, which would break the table cell", () => {
    const bad = {
      ...registry,
      areas: [{ ...registry.areas[0], docsDetects: "a | b" }],
    };
    assert.ok(validateRegistry(bad).some((e) => /breaks table rendering/.test(e)));
  });

  it("rejects a docPath the sidebar parser could not derive the area from", () => {
    // parseSidebarAreas reads the area back out of /audit-<area>; a
    // mismatch would make the generated sidebar disagree with itself.
    const bad = {
      ...registry,
      areas: [{ ...registry.areas[0], docPath: "/commands/storage/audit-swift-data" }],
    };
    assert.ok(validateRegistry(bad).some((e) => /must end with '\/audit-swiftdata'/.test(e)));
  });

  it("rejects 'all', which is the meta-target rather than an area", () => {
    const bad = {
      ...registry,
      areas: [{ ...registry.areas[0], area: "all", docPath: "/commands/storage/audit-all" }],
    };
    assert.ok(validateRegistry(bad).some((e) => /meta-target/.test(e)));
  });

  it("rejects a group declared in groupOrder but used by no area", () => {
    const bad = { ...registry, groupOrder: [...registry.groupOrder, "Games"] };
    assert.ok(validateRegistry(bad).some((e) => /group 'Games'.*no areas/.test(e)));
  });
});

describe("renderArgumentList", () => {
  it("renders the meta-target first, then areas in canonical order", () => {
    assert.equal(
      renderArgumentList(registry),
      'argument: "area (optional) - Which audit to run: all, build, icloud, swiftdata"',
    );
  });
});

describe("renderBodyTable", () => {
  it("renders the model-facing detects text in canonical order", () => {
    assert.equal(
      renderBodyTable(registry),
      [
        "| Area | Agent | Detects |",
        "|------|-------|---------|",
        "| build | build-optimizer | Build time optimization opportunities |",
        "| icloud | icloud-auditor | iCloud integration issues, entitlements |",
        "| swiftdata | swiftdata-auditor | @Model struct, VersionedSchema, relationship defaults |",
      ].join("\n"),
    );
  });
});

describe("renderDocsTables", () => {
  it("renders one table per group, using the human-facing text", () => {
    assert.equal(
      renderDocsTables(registry),
      [
        "### Build",
        "| Area | What It Checks |",
        "|------|----------------|",
        "| `build` | Build time optimization opportunities |",
        "",
        "### Storage",
        "| Area | What It Checks |",
        "|------|----------------|",
        "| `icloud` | iCloud entitlements, file coordination, CloudKit errors |",
        "| `swiftdata` | @Model correctness, VersionedSchema, relationship defaults |",
      ].join("\n"),
    );
  });

  it("uses docsDetects, not detects — the two differ on purpose", () => {
    const out = renderDocsTables(registry);
    assert.match(out, /iCloud entitlements, file coordination, CloudKit errors/);
    assert.doesNotMatch(out, /iCloud integration issues, entitlements/);
  });
});

describe("expectedSidebarGroups", () => {
  it("returns audit areas per group, in registry order", () => {
    assert.deepEqual(expectedSidebarGroups(registry), [
      { group: "Build", areas: ["build"] },
      { group: "Storage", areas: ["icloud", "swiftdata"] },
    ]);
  });

  it("omits groups that have no areas", () => {
    const withEmpty = { ...registry, groupOrder: ["Build", "Games", "Storage"] };
    assert.deepEqual(expectedSidebarGroups(withEmpty).map((g) => g.group), ["Build", "Storage"]);
  });
});

describe("validateSidebarAgainstRegistry", () => {
  it("accepts a sidebar matching the registry", () => {
    assert.deepEqual(
      validateSidebarAgainstRegistry(registry, expectedSidebarGroups(registry)),
      [],
    );
  });

  it("flags an area present in the registry but missing from the sidebar", () => {
    const actual = [
      { group: "Build", areas: ["build"] },
      { group: "Storage", areas: ["icloud"] },
    ];
    const errs = validateSidebarAgainstRegistry(registry, actual);
    assert.equal(errs.length, 1);
    assert.match(errs[0], /Storage/);
    assert.match(errs[0], /swiftdata/);
  });

  it("flags within-group order drift", () => {
    const actual = [
      { group: "Build", areas: ["build"] },
      { group: "Storage", areas: ["swiftdata", "icloud"] },
    ];
    assert.equal(validateSidebarAgainstRegistry(registry, actual).length, 1);
  });

  it("reports group misalignment once, not per item", () => {
    const actual = [{ group: "Storage", areas: ["icloud", "swiftdata"] }];
    const errs = validateSidebarAgainstRegistry(registry, actual);
    assert.equal(errs.length, 1);
    assert.match(errs[0], /groups differ/);
  });
});

describe("spliceRegion", () => {
  const doc = [
    "before",
    "<!-- X_BEGIN — generated -->",
    "old content",
    "still old",
    "<!-- X_END -->",
    "after",
  ].join("\n");

  it("replaces only the content between the markers", () => {
    assert.equal(
      spliceRegion(doc, "X", "NEW"),
      ["before", "<!-- X_BEGIN — generated -->", "NEW", "<!-- X_END -->", "after"].join("\n"),
    );
  });

  it("is idempotent — splicing the same content twice is a fixed point", () => {
    const once = spliceRegion(doc, "X", "NEW");
    assert.equal(spliceRegion(once!, "X", "NEW"), once);
  });

  it("supports line-comment markers for TypeScript config files", () => {
    const ts = ["a", "// Y_BEGIN", "old", "// Y_END", "b"].join("\n");
    assert.equal(
      spliceRegion(ts, "Y", "new", "line"),
      ["a", "// Y_BEGIN", "new", "// Y_END", "b"].join("\n"),
    );
  });

  it("supports hash markers for YAML frontmatter, where HTML comments are not comments", () => {
    const yaml = ["description: x", "# Z_BEGIN", "old: y", "# Z_END", "other: z"].join("\n");
    assert.equal(
      spliceRegion(yaml, "Z", "new: y", "hash"),
      ["description: x", "# Z_BEGIN", "new: y", "# Z_END", "other: z"].join("\n"),
    );
  });

  it("returns null when a marker is missing, rather than writing garbage", () => {
    assert.equal(spliceRegion("no markers here", "X", "NEW"), null);
    assert.equal(spliceRegion("<!-- X_BEGIN -->\nonly open", "X", "NEW"), null);
  });

  it("returns null when the markers are inverted", () => {
    const inverted = ["<!-- X_END -->", "<!-- X_BEGIN -->"].join("\n");
    assert.equal(spliceRegion(inverted, "X", "NEW"), null);
  });
});
