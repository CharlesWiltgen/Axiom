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

import { spawn } from "node:child_process";

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
const ENVIRONMENT_CODES = [
  "EACCES",
  "EPERM",
  "ENOSPC",
  "EMFILE",
  "EROFS",
] as const;

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
export function classifyNpmFailure(
  output: string,
  opts: { timedOut?: boolean } = {},
): NpmFailureKind {
  // A code npm actually printed outranks the timeout: it can report a conflict
  // and then hang fetching more metadata, and discarding what it already said
  // would hide a real defect behind a skip.
  const printed = npmErrorCode(output);
  if (printed) {
    if ((NETWORK_CODES as readonly string[]).includes(printed)) {
      return "network";
    }
    if ((ENVIRONMENT_CODES as readonly string[]).includes(printed)) {
      return "environment";
    }
    return "resolution";
  }
  // npm itself missing from PATH is an environment problem, not a manifest one.
  // `test`/`test:full` run as bare `node scripts/pre-deploy.ts`, so a shell
  // without the mise shim lands here with a 127 and this message.
  if (/(?:^|\n|:\s)[^\n]*npm: command not found/.test(output)) {
    return "environment";
  }
  // Nothing to go on: a killed call is inconclusive, anything else is a failure.
  if (opts.timedOut) return "network";
  return NETWORK_CODES.some((code) => output.includes(code))
    ? "network"
    : "resolution";
}

export type NpmDryRunResult = {
  stdout: string;
  stderr: string;
  status: number | null;
  timedOut: boolean;
  errorCode: string | undefined;
};

type NpmDryRunCleanupError = Error & {
  readonly __brand: "NpmDryRunCleanupError";
};

export function npmInstallEnvironment(
  source: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const env = { ...source };
  // npm run exports this one-off option, which project installs reject. Keep
  // project allowScripts and strict policy intact, matching a direct npm call.
  delete env.npm_config_allow_scripts;
  delete env.NPM_CONFIG_ALLOW_SCRIPTS;
  return env;
}

export async function runNpmDryRun(
  cwd: string,
  opts: { timeoutMs?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<NpmDryRunResult> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError(
      `npm dry-run in ${cwd}: timeout must be positive and finite`,
    );
  }
  const env = npmInstallEnvironment(opts.env ?? process.env);
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["install", "--omit=dev", "--dry-run"], {
      cwd,
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const outputLimit = 1024 * 1024;
    let outputBytes = 0;
    let timedOut = false;
    let errorCode: string | undefined;
    let settled = false;
    let leaderStatus: number | null | undefined;
    const stop = () => {
      if (!child.pid) return;
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ESRCH") return;
        clearTimeout(timer);
        child.stdout.destroy();
        child.stderr.destroy();
        child.unref();
        settled = true;
        const failure: NpmDryRunCleanupError = Object.assign(
          new Error(
            `npm dry-run: cannot stop owned process group ${child.pid} (${
              code ?? "unknown"
            })`,
          ),
          { __brand: "NpmDryRunCleanupError" as const },
        );
        reject(failure);
      }
    };
    const timer = setTimeout(() => {
      // Descendants can retain pipes after the leader exits. Bound draining
      // without turning the leader's known result into a registry timeout.
      if (leaderStatus === undefined) {
        timedOut = true;
        errorCode ??= "ETIMEDOUT";
      }
      finish(leaderStatus ?? null, true);
    }, timeoutMs);
    const capture = (chunks: Buffer[], buffer: Buffer) => {
      const available = outputLimit - outputBytes;
      const kept = buffer.subarray(0, available);
      if (kept.length) chunks.push(kept);
      outputBytes += kept.length;
      if (buffer.length > available) {
        errorCode ??= "ENOBUFS";
        finish(leaderStatus ?? null, true);
      }
    };
    const finish = (status: number | null, closeStreams = false) => {
      if (settled) return;
      clearTimeout(timer);
      stop();
      if (settled) return;
      settled = true;
      if (closeStreams) {
        child.stdout.destroy();
        child.stderr.destroy();
        child.unref();
      }
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        status,
        timedOut,
        errorCode,
      });
    };
    child.stdout.on("data", (buffer: Buffer) => capture(stdout, buffer));
    child.stderr.on("data", (buffer: Buffer) => capture(stderr, buffer));
    child.once("error", (error: NodeJS.ErrnoException) => {
      errorCode = error.code ?? "ESPAWN";
      finish(null);
    });
    child.once("exit", (status) => {
      if (settled) return;
      leaderStatus = status;
      stop();
    });
    child.once("close", (status) => finish(status));
  });
}
