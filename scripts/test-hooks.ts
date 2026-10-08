// `npm run test:hooks` — the Python hook suites, through the same runner
// pre-deploy uses, so CI catches hook regressions without relying on a
// maintainer's machine.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHookSuites } from "./hook-suites.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = path.join(root, ".claude-plugin/plugins/axiom");
const { runs, failures } = runHookSuites(pluginDir);

for (const run of runs) console.log(`  ✓ ${run.file} (${run.ran})`);
for (const failure of failures) console.error(`  ✗ ${failure.message}`);

if (runs.length === 0 && failures.length === 0) {
  console.error("  ✗ no hooks/*_test.py suites found");
  process.exit(1);
}

process.exit(failures.length > 0 ? 1 : 0);
