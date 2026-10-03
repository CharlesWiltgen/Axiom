/**
 * Tests for scripts/npm-resolution.ts.
 *
 * Run via `node --test scripts/npm-resolution.test.ts` (Node 24 native), and
 * wired into npm `test:unit` by the scripts/*.test.ts glob.
 *
 * The function is pure: pre-deploy.ts runs npm and passes the combined output
 * plus whether the call was killed for exceeding its timeout.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyNpmFailure, npmErrorCode, npmInstallEnvironment } from "./npm-resolution.ts";

describe("npmInstallEnvironment", () => {
  it("removes inherited one-off script options while preserving project policy and the input", () => {
    const expected = { PATH: "/usr/bin", npm_config_strict_allow_scripts: "true", npm_config_userconfig: "/project/.npmrc" };
    const source = { ...expected, npm_config_allow_scripts: "*", NPM_CONFIG_ALLOW_SCRIPTS: "*" };
    assert.deepEqual(npmInstallEnvironment(source), expected);
    assert.deepEqual(source, { ...expected, npm_config_allow_scripts: "*", NPM_CONFIG_ALLOW_SCRIPTS: "*" });
  });
});

describe("classifyNpmFailure", () => {
  it("calls a peer conflict a resolution failure (GH #54, the case the gate was built for)", () => {
    assert.equal(
      classifyNpmFailure("npm error code ERESOLVE\nnpm error ERESOLVE unable to resolve dependency tree"),
      "resolution",
    );
  });

  it("calls an unresolvable pin a resolution failure", () => {
    // Measured against a manifest pinning vitepress: 99.99.99 — npm reports
    // ETARGET, which the original gate treated as "offline?" and PASSED. An
    // unresolvable pin breaks `pi install git:` exactly as ERESOLVE does.
    assert.equal(
      classifyNpmFailure("npm error code ETARGET\nnpm error notarget No matching version found for vitepress@99.99.99"),
      "resolution",
    );
  });

  it("treats a genuinely unreachable registry as network", () => {
    // npm's own network group (lib/utils/error-message.js: ECONNRESET, ENOTFOUND,
    // ETIMEDOUT, ERR_SOCKET_TIMEOUT, EAI_FAIL), other socket failures, and registry
    // server errors, which npm-registry-fetch reports as `E${status}`.
    for (const code of [
      "ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "ENETUNREACH", "EAI_AGAIN", "ERR_SOCKET_TIMEOUT",
      "ECONNRESET", "EAI_FAIL", "EHOSTUNREACH", "ECONNABORTED", "EPIPE",
      "E429", "E500", "E502", "E503", "E504",
    ]) {
      assert.equal(
        classifyNpmFailure(`npm error code ${code}\nnpm error network request to https://registry.npmjs.org failed`),
        "network",
        `${code} should not fail the release`,
      );
    }
  });

  it("treats a timed-out call with nothing to go on as network", () => {
    // A black-holed registry produces no error code at all — the call simply
    // never returns, which is why it is bounded. Inconclusive is not a defect.
    assert.equal(classifyNpmFailure("", { timedOut: true }), "network");
    assert.equal(classifyNpmFailure("npm warn using --force", { timedOut: true }), "network");
  });

  it("keeps a resolution code npm printed BEFORE the timeout killed it", () => {
    // npm can report the conflict and then hang fetching more metadata. The
    // timeout says the call was inconclusive, not that the code it already
    // printed was wrong — discarding it would hide a real defect behind a skip.
    assert.equal(classifyNpmFailure("npm error code ERESOLVE\nnpm error ...", { timedOut: true }), "resolution");
  });

  it("keeps a network code npm printed before the timeout", () => {
    assert.equal(classifyNpmFailure("npm error code ECONNREFUSED", { timedOut: true }), "network");
  });

  it("calls a broken local environment environment, not a broken manifest", () => {
    // Measured: an unwritable npm cache yields EACCES and npm missing from PATH
    // yields `/bin/sh: npm: command not found`. Neither says anything about the
    // dependency graph, so neither should read as "your manifest is broken".
    assert.equal(classifyNpmFailure("npm error code EACCES\nnpm error Your cache folder contains root-owned files"), "environment");
    assert.equal(classifyNpmFailure("npm error code EPERM"), "environment");
    assert.equal(classifyNpmFailure("npm error code ENOSPC"), "environment");
    assert.equal(classifyNpmFailure("/bin/sh: npm: command not found\n"), "environment");
  });

  it("calls proxy certificate failures environment", () => {
    // Node's TLS codes reach npm's output unchanged behind an intercepting proxy.
    for (const code of [
      "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "DEPTH_ZERO_SELF_SIGNED_CERT", "CERT_HAS_EXPIRED",
    ]) {
      assert.equal(classifyNpmFailure(`npm error code ${code}`), "environment", `${code} is not a manifest defect`);
    }
  });

  it("keeps the gate's own output overflow failing, since npm's real code may be cut off", () => {
    // npm prints its error code last; past the 1 MiB capture cap an ERESOLVE line is
    // lost and only ENOBUFS remains. Skipping on it could ship a broken manifest.
    assert.equal(classifyNpmFailure("npm warn ...\nnpm error code ENOBUFS"), "resolution");
  });

  it("matches the no-code fallback on whole codes only", () => {
    assert.equal(classifyNpmFailure("request failed: ECONNRESET while fetching"), "network");
    assert.equal(classifyNpmFailure("integrity sha512-QE500xEPIPEz mismatch"), "resolution");
  });

  it("still treats a missing package as a resolution failure", () => {
    assert.equal(classifyNpmFailure("npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/nope"), "resolution");
  });

  it("fails closed on an unrecognized failure", () => {
    // The original discrimination was the wrong way round: it named the one
    // failure it knew and let everything else pass. An unknown npm failure is
    // still a failure of the command Pi's install path depends on.
    assert.equal(classifyNpmFailure("npm error code EBADSOMETHING\nnpm error something new"), "resolution");
    assert.equal(classifyNpmFailure(""), "resolution");
  });
});

describe("npmErrorCode", () => {
  it("returns the code npm printed, wherever in the output it landed", () => {
    // Not the first line: an `npm warn` displaces it, and `out` is stderr and
    // stdout concatenated with no separator, so line 1 is not reliably the error.
    assert.equal(
      npmErrorCode("npm warn using --force Recommended protections disabled.\nnpm error code ETARGET"),
      "ETARGET",
    );
  });

  it("returns undefined when npm printed no code", () => {
    assert.equal(npmErrorCode(""), undefined);
    assert.equal(npmErrorCode("/bin/sh: npm: command not found"), undefined);
  });
});
