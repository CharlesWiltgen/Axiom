import assert from "node:assert/strict";
import test from "node:test";
import {
  assertHostClaimRewritesFired,
  resetHostClaimRewriteTracking,
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
