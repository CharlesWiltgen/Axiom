/**
 * Classifies a failed `npm install --omit=dev --dry-run` for pre-deploy's Pi
 * install gate (§12k).
 *
 * Pi's documented install runs that command, and `--omit=dev` still RESOLVES the
 * whole graph — so any resolution failure aborts `pi install git:` before Axiom
 * delivers anything (GH #54). The gate therefore has to separate "Axiom's
 * manifest is broken" from everything else that can make the command fail.
 *
 * The discrimination runs fail-closed, which is the opposite of how it started:
 * the original named the single failure it knew (ERESOLVE) and let everything
 * else pass as "offline?". Measured against a manifest pinning vitepress
 * 99.99.99, npm reports ETARGET, and the gate printed a skip and PASSED on a
 * manifest that breaks every user's install. So an unrecognized failure is a
 * failure — but a machine that cannot reach the registry, or cannot run npm at
 * all, is not evidence about the manifest either way.
 */

/** npm's error codes for "the registry could not be reached". */
const NETWORK_CODES = [
  "ENOTFOUND",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENETUNREACH",
  "EAI_AGAIN",
  "ERR_SOCKET_TIMEOUT",
] as const;

/**
 * Codes for a broken local environment rather than a broken dependency graph —
 * measured: an unwritable npm cache (the root-owned `~/.npm` classic) reports
 * EACCES, and a full disk reports ENOSPC. Reporting either as "your manifest
 * does not resolve" sends the reader to the wrong file.
 */
const ENVIRONMENT_CODES = ["EACCES", "EPERM", "ENOSPC", "EMFILE", "EROFS"] as const;

export type NpmFailureKind = "network" | "environment" | "resolution";

/**
 * The code npm printed, if it printed one. Deliberately not "the first line":
 * an `npm warn` displaces it, and the caller concatenates stderr and stdout with
 * no separator, so line 1 is not reliably the error — and quoting arbitrary
 * output can surface a registry URL carrying basic-auth credentials.
 */
export function npmErrorCode(output: string): string | undefined {
  return output.match(/npm error code (\S+)/)?.[1];
}

/**
 * `output` is npm's stderr and stdout combined; `timedOut` reports that the call
 * was killed for exceeding its timeout, which is inconclusive rather than a
 * defect — a black-holed registry prints no error code at all and simply never
 * returns.
 */
export function classifyNpmFailure(output: string, opts: { timedOut?: boolean } = {}): NpmFailureKind {
  // A code npm actually printed outranks the timeout: it can report a conflict
  // and then hang fetching more metadata, and discarding what it already said
  // would hide a real defect behind a skip.
  const printed = npmErrorCode(output);
  if (printed) {
    if ((NETWORK_CODES as readonly string[]).includes(printed)) return "network";
    if ((ENVIRONMENT_CODES as readonly string[]).includes(printed)) return "environment";
    return "resolution";
  }
  // npm itself missing from PATH is an environment problem, not a manifest one.
  // `test`/`test:full` run as bare `node scripts/pre-deploy.ts`, so a shell
  // without the mise shim lands here with a 127 and this message.
  if (/(?:^|\n|:\s)[^\n]*npm: command not found/.test(output)) return "environment";
  // Nothing to go on: a killed call is inconclusive, anything else is a failure.
  if (opts.timedOut) return "network";
  return NETWORK_CODES.some((code) => output.includes(code)) ? "network" : "resolution";
}
