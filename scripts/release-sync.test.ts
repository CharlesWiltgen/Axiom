import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyReleaseSync,
  compareVersions,
  unpublishedShippedVersions,
} from "./release-sync.ts";

test("orders releases above their prereleases", () => {
  assert.ok(compareVersions("27.0.0-beta.47", "27.0.0-beta.48") < 0);
  assert.ok(compareVersions("27.0.0-beta.9", "27.0.0-beta.10") < 0, "numeric, not lexical");
  assert.ok(compareVersions("27.0.0-beta.48", "27.0.0-rc.1") < 0);
  assert.ok(compareVersions("27.0.0-rc.1", "27.0.0") < 0);
  assert.ok(compareVersions("27.0.1", "27.1.0") < 0);
  assert.equal(compareVersions("27.0.0-beta.48", "27.0.0-beta.48"), 0);
});

// The beta.48 case. The tag was pushed — which ships the plugin, because the
// marketplace is just `main` — but `npm publish` never ran, so MCP users stayed
// on beta.47 with nothing detecting the divergence.
test("flags a tag that shipped to plugin users but never reached npm", () => {
  assert.deepEqual(
    unpublishedShippedVersions({
      canonical: "27.0.0-beta.48",
      pushedTags: ["v27.0.0-beta.46", "v27.0.0-beta.47", "v27.0.0-beta.48"],
      publishedToNpm: ["27.0.0-beta.46", "27.0.0-beta.47"],
    }),
    ["27.0.0-beta.48"],
  );
});

test("is quiet when both surfaces agree", () => {
  assert.deepEqual(
    unpublishedShippedVersions({
      canonical: "27.0.0-beta.48",
      pushedTags: ["v27.0.0-beta.47", "v27.0.0-beta.48"],
      publishedToNpm: ["27.0.0-beta.47", "27.0.0-beta.48"],
    }),
    [],
  );
});

// Mid-release: the manifest is bumped but the tag does not exist yet. Nothing
// has shipped, so there is nothing to complain about.
test("ignores a canonical version that has not been tagged yet", () => {
  assert.deepEqual(
    unpublishedShippedVersions({
      canonical: "27.0.0-beta.49",
      pushedTags: ["v27.0.0-beta.47", "v27.0.0-beta.48"],
      publishedToNpm: ["27.0.0-beta.47", "27.0.0-beta.48"],
    }),
    [],
  );
});

// A local-only tag has shipped nothing — only a PUSHED tag reaches users,
// because the marketplace serves whatever is on main.
test("only pushed tags count as shipped", () => {
  assert.deepEqual(
    unpublishedShippedVersions({
      canonical: "27.0.0-beta.48",
      pushedTags: ["v27.0.0-beta.47"],
      localOnlyTags: ["v27.0.0-beta.48"],
      publishedToNpm: ["27.0.0-beta.47"],
    }),
    [],
  );
});

test("reports every gap, oldest first, not just the newest", () => {
  assert.deepEqual(
    unpublishedShippedVersions({
      canonical: "27.0.0-beta.48",
      pushedTags: ["v27.0.0-beta.46", "v27.0.0-beta.47", "v27.0.0-beta.48"],
      publishedToNpm: ["27.0.0-beta.46"],
    }),
    ["27.0.0-beta.47", "27.0.0-beta.48"],
  );
});

test("ignores tags above canonical and unparseable tag names", () => {
  assert.deepEqual(
    unpublishedShippedVersions({
      canonical: "27.0.0-beta.47",
      pushedTags: ["v27.0.0-beta.47", "v27.0.0-beta.48", "vNotAVersion", "axiom--v1"],
      publishedToNpm: ["27.0.0-beta.47"],
    }),
    [],
  );
});

// A gap only demands action if nothing in flight will close it. Once the manifest
// is bumped past a missing version, the next publish supersedes it — npm users
// skip straight from the last published version to the new one. Erroring on that
// would block every validation run during the cycle that fixes it.
test("classifies a gap below canonical as superseded by the release in progress", () => {
  const v = classifyReleaseSync({
    canonical: "27.0.0-beta.49",
    pushedTags: ["v27.0.0-beta.47", "v27.0.0-beta.48"],
    publishedToNpm: ["27.0.0-beta.47"],
  });
  assert.deepEqual(v.superseded, ["27.0.0-beta.48"]);
  assert.deepEqual(v.unresolved, []);
});

// The beta.48 case as it stood BEFORE the bump: the shipped version is the
// canonical one, so nothing is coming to fix it. That must fail.
test("classifies a gap at canonical as unresolved", () => {
  const v = classifyReleaseSync({
    canonical: "27.0.0-beta.48",
    pushedTags: ["v27.0.0-beta.47", "v27.0.0-beta.48"],
    publishedToNpm: ["27.0.0-beta.47"],
  });
  assert.deepEqual(v.unresolved, ["27.0.0-beta.48"]);
  assert.deepEqual(v.superseded, []);
});

// The failure the gate exists for: the release tagged and pushed (plugin users
// have it) but npm publish skipped.
test("a tagged-and-pushed canonical missing from npm is unresolved", () => {
  const v = classifyReleaseSync({
    canonical: "27.0.0-beta.49",
    pushedTags: ["v27.0.0-beta.48", "v27.0.0-beta.49"],
    publishedToNpm: ["27.0.0-beta.47"],
  });
  assert.deepEqual(v.unresolved, ["27.0.0-beta.49"]);
  assert.deepEqual(v.superseded, ["27.0.0-beta.48"]);
});

test("reports nothing when both surfaces agree", () => {
  const v = classifyReleaseSync({
    canonical: "27.0.0-beta.49",
    pushedTags: ["v27.0.0-beta.48"],
    publishedToNpm: ["27.0.0-beta.48"],
  });
  assert.deepEqual(v, { unresolved: [], superseded: [] });
});
