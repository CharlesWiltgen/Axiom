import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {
  assertHostClaimRewritesFired,
  resetHostClaimRewriteTracking,
  rewriteCursorSkillReferences,
} from "./references.ts";

test("a host-claim rewrite that matches no canonical prose fails the build", () => {
  // Simulates canonical wording drifting out from under a pinned pattern: with nothing
  // rewritten since the reset, every pattern is dead and the build must refuse to ship.
  resetHostClaimRewriteTracking();
  assert.throws(
    () => assertHostClaimRewritesFired(),
    /matched no canonical text/,
  );
});

for (const name of ["xclog", "xcsym", "xcui", "xcprof"]) {
  test(`Cursor ${name} guidance excludes Codex package paths and Claude PATH claims`, () => {
    const source = fs.readFileSync(`.claude-plugin/plugins/axiom/skills/axiom-tools/skills/${name}-ref.md`, "utf8");
    const rewritten = rewriteCursorSkillReferences(source);
    assert.equal(/Codex plugin installs|<plugin-root>|On \*\*Claude Code\*\*/.test(rewritten), false, `${name} retained another harness invocation`);
    assert.match(rewritten, /In Cursor,/);
  });
}
