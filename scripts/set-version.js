#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { VERSION_RE, VERSION_CORE } from './version-regex.js';
import { isCursorGeneratedPath } from './cursor-output.js';
import { isCodexGeneratedPath } from './codex-output.js';
import { DOC_STAT_FILES, docStatValues, applyDocStats, checkMarkerSpec } from './doc-stats.js';
import { isGeneratedSubSkill } from './inline-auditors.ts';
import { manifestUpdates } from './manifest.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse args: positional version, optional --tag flag
const args = process.argv.slice(2);
const tagFlag = args.includes('--tag');
const version = args.find(a => !a.startsWith('-'));

if (!version?.match(VERSION_RE)) {
  console.error('❌ Usage: node set-version.js X.Y.Z[-beta.N|-rc.N] [--tag]');
  console.error('   Example: node set-version.js 0.9.37');
  console.error('   Example: node set-version.js 27.0.0-beta.1   (prerelease — beta/rc only)');
  console.error('   Example: node set-version.js 0.9.37 --tag   (also creates annotated git tag v0.9.37)');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const pluginDir = path.join(root, '.claude-plugin/plugins/axiom');

try {
  // Auto-count components
  const skillsDir = path.join(pluginDir, 'skills');
  if (!fs.existsSync(skillsDir)) {
    throw new Error(`Skills directory not found: ${skillsDir}`);
  }
  // Recursively find all skill content units.
  // A "skill" is either:
  //   - A standalone SKILL.md (directory has no skills/ subdir)
  //   - Each skills/*.md file in a skill suite (directory has skills/ subdir)
  // Skill suite SKILL.md files are routers, not counted as skills.
  const skillNames = [];
  let suiteCount = 0;
  function findSkills(dir) {
    for (const name of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, name);
      const stat = fs.statSync(fullPath, { throwIfNoEntry: false });
      if (!stat?.isDirectory()) continue;
      const skillFile = path.join(fullPath, 'SKILL.md');
      const refsDir = path.join(fullPath, 'skills');
      if (fs.existsSync(skillFile)) {
        if (fs.existsSync(refsDir) && fs.statSync(refsDir).isDirectory()) {
          // Skill suite: count each skills/*.md as a skill, not the SKILL.md
          suiteCount++;
          for (const ref of fs.readdirSync(refsDir)) {
            if (!ref.endsWith('.md')) continue;
            // Router-inlined auditors are generated mirrors of agents (already
            // counted in the agent total) — see scripts/inline-auditors.ts.
            // Counting them here would inflate the advertised skill count with
            // duplicated content rather than new capability.
            const refContent = fs.readFileSync(path.join(refsDir, ref), 'utf8');
            if (isGeneratedSubSkill(refContent)) continue;
            skillNames.push(ref.replace(/\.md$/, ''));
          }
        } else {
          // Standalone skill
          skillNames.push(name);
        }
      }
      // Recurse into subdirectories (e.g., axiom-ios-ml/coreml/)
      findSkills(fullPath);
    }
  }
  findSkills(skillsDir);

  const skillsCount = skillNames.length;

  // Count skills by type
  let disciplineCount = 0;
  let referenceCount = 0;
  let diagnosticCount = 0;

  for (const skillName of skillNames) {
    if (skillName.endsWith('-ref')) {
      referenceCount++;
    } else if (skillName.endsWith('-diag')) {
      diagnosticCount++;
    } else {
      disciplineCount++;
    }
  }

  const agentsDir = path.join(pluginDir, 'agents');
  if (!fs.existsSync(agentsDir)) {
    throw new Error(`Agents directory not found: ${agentsDir}`);
  }
  const agentsCount = fs.readdirSync(agentsDir)
    .filter(name => {
      const stat = fs.statSync(path.join(agentsDir, name), { throwIfNoEntry: false });
      return stat?.isFile() && name.endsWith('.md');
    }).length;

  const commandsDir = path.join(pluginDir, 'commands');
  if (!fs.existsSync(commandsDir)) {
    throw new Error(`Commands directory not found: ${commandsDir}`);
  }
  const commandsCount = fs.readdirSync(commandsDir)
    .filter(name => {
      const stat = fs.statSync(path.join(commandsDir, name), { throwIfNoEntry: false });
      return stat?.isFile() && name.endsWith('.md');
    }).length;

  // Generate stats.json for VitePress
  const statsPath = path.join(root, 'docs/.vitepress/theme/stats.json');
  const statsData = {
    disciplineSkills: disciplineCount,
    referenceSkills: referenceCount,
    diagnosticSkills: diagnosticCount,
    commands: commandsCount,
    agents: agentsCount,
    // Layer-1 router count — the "27 skill routers" the install guides quote.
    routers: suiteCount
  };

  // Prepare all updates
  const updates = [];

  // Add stats.json to updates
  updates.push({
    path: statsPath,
    content: JSON.stringify(statsData, null, 2) + '\n',
    label: 'docs/.vitepress/theme/stats.json'
  });

  // 1. Read and prepare claude-code.json update
  const claudeCodePath = path.join(pluginDir, 'claude-code.json');
  if (!fs.existsSync(claudeCodePath)) {
    throw new Error(`Plugin manifest not found: ${claudeCodePath}`);
  }
  let claudeCode;
  try {
    claudeCode = JSON.parse(fs.readFileSync(claudeCodePath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse claude-code.json: ${err.message}`);
  }
  claudeCode.version = version;
  // Regenerate the frontmatter-derived artifacts — the skills array and the
  // /axiom:ask built from it. Same code path as `npm run build:manifest`, so a
  // content-only regeneration and a release cannot diverge.
  updates.push(...manifestUpdates(claudeCode, pluginDir));

  // 1b. Prepare .claude-plugin/plugin.json — the manifest Claude Code actually
  // reads. Without it the plugin name falls back to the install directory (a
  // version, in a marketplace cache), namespacing skills/agents/commands as
  // `27.0.0-beta.N:axiom-swiftui`. See Axiom-6vd / GH #53.
  const pluginManifestPath = path.join(pluginDir, '.claude-plugin/plugin.json');
  if (!fs.existsSync(pluginManifestPath)) {
    throw new Error(`Plugin manifest not found: ${pluginManifestPath}`);
  }
  let pluginManifest;
  try {
    pluginManifest = JSON.parse(fs.readFileSync(pluginManifestPath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse .claude-plugin/plugin.json: ${err.message}`);
  }
  pluginManifest.version = version;
  updates.push({
    path: pluginManifestPath,
    content: JSON.stringify(pluginManifest, null, 2) + '\n',
    label: '.claude-plugin/plugins/axiom/.claude-plugin/plugin.json'
  });

  // 2. Read and prepare marketplace.json update
  const marketplacePath = path.join(root, '.claude-plugin/marketplace.json');
  if (!fs.existsSync(marketplacePath)) {
    throw new Error(`Marketplace manifest not found: ${marketplacePath}`);
  }
  let marketplace;
  try {
    marketplace = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse marketplace.json: ${err.message}`);
  }
  const plugin = marketplace.plugins?.find(p => p.name === 'axiom');
  if (!plugin) {
    throw new Error('axiom plugin not found in marketplace.json');
  }
  plugin.version = version;
  updates.push({
    path: marketplacePath,
    content: JSON.stringify(marketplace, null, 2) + '\n',
    label: '.claude-plugin/marketplace.json'
  });

  // 3. Prepare VitePress config.ts update
  const configPath = path.join(root, 'docs/.vitepress/config.ts');
  if (!fs.existsSync(configPath)) {
    throw new Error(`VitePress config not found: ${configPath}`);
  }
  let configContent = fs.readFileSync(configPath, 'utf8');
  const versionRegex = new RegExp(`(copyright: '[^']*• v)(${VERSION_CORE})(')`);
  if (!versionRegex.test(configContent)) {
    throw new Error('Version string not found in config.ts footer');
  }
  configContent = configContent.replace(versionRegex, `$1${version}$3`);
  updates.push({
    path: configPath,
    content: configContent,
    label: 'docs/.vitepress/config.ts'
  });

  // 4. Prepare metadata.txt update
  const metadataPath = path.join(pluginDir, 'hooks/metadata.txt');
  const hooksDir = path.dirname(metadataPath);
  if (!fs.existsSync(hooksDir)) {
    throw new Error(`Hooks directory not found: ${hooksDir}`);
  }
  const metadata = `${version}\n${skillsCount}\n${agentsCount}\n${commandsCount}\n`;
  updates.push({
    path: metadataPath,
    content: metadata,
    label: '.claude-plugin/plugins/axiom/hooks/metadata.txt'
  });

  // 5. Prepare root package.json update
  const rootPackagePath = path.join(root, 'package.json');
  if (fs.existsSync(rootPackagePath)) {
    let rootPackage;
    try {
      rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
    } catch (err) {
      throw new Error(`Failed to parse package.json: ${err.message}`);
    }
    rootPackage.version = version;
    updates.push({
      path: rootPackagePath,
      content: JSON.stringify(rootPackage, null, 2) + '\n',
      label: 'package.json'
    });
  }

  // 6. Prepare axiom-mcp/package.json update
  const mcpPackagePath = path.join(root, 'axiom-mcp/package.json');
  if (fs.existsSync(mcpPackagePath)) {
    let mcpPackage;
    try {
      mcpPackage = JSON.parse(fs.readFileSync(mcpPackagePath, 'utf8'));
    } catch (err) {
      throw new Error(`Failed to parse axiom-mcp/package.json: ${err.message}`);
    }
    mcpPackage.version = version;
    updates.push({
      path: mcpPackagePath,
      content: JSON.stringify(mcpPackage, null, 2) + '\n',
      label: 'axiom-mcp/package.json'
    });
  }

  // 7. Prepare README.md stats-block update (closes axiom-wz9k).
  // README counts were drifting silently every release because the script
  // updated metadata.txt/stats.json but never touched README. Now the
  // script rewrites the marked block between AXIOM_STATS_BEGIN and
  // AXIOM_STATS_END. Hand-editing the block prints a warning; missing
  // markers fail the script. Parity is also enforced by pre-deploy.ts.
  const readmePath = path.join(root, 'README.md');
  if (fs.existsSync(readmePath)) {
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    const beginMarker = '<!-- AXIOM_STATS_BEGIN';
    const endMarker = '<!-- AXIOM_STATS_END -->';
    const beginIdx = readmeContent.indexOf(beginMarker);
    const endIdx = readmeContent.indexOf(endMarker);
    if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
      throw new Error(
        `README.md is missing AXIOM_STATS markers — expected '${beginMarker} ...' and '${endMarker}'. ` +
        `Restore the marked block around the skills/agents/commands count lines.`
      );
    }
    // Preserve the begin-marker line as-is (it includes the auto-maintenance comment).
    const beginLineEnd = readmeContent.indexOf('\n', beginIdx);
    const newStatsBlock =
      readmeContent.slice(beginIdx, beginLineEnd + 1) +
      `- **${skillsCount} skills** covering UI, data, concurrency, performance, networking, accessibility, and more\n` +
      `- **${agentsCount} agents** that autonomously scan for issues (memory leaks, concurrency violations, build problems)\n` +
      `- **${commandsCount} commands** for quick audits and diagnostics\n` +
      endMarker;
    const newReadmeContent =
      readmeContent.slice(0, beginIdx) +
      newStatsBlock +
      readmeContent.slice(endIdx + endMarker.length);
    if (newReadmeContent !== readmeContent) {
      updates.push({
        path: readmePath,
        content: newReadmeContent,
        label: 'README.md'
      });
    }
  }

  // 8. Auto-maintain skill/agent/command counts embedded in human-facing docs
  //    (docs/start/*.md, docs/agents/index.md, …) — the same drift class README
  //    hit under axiom-wz9k, generalized. Each maintained number is wrapped in an
  //    invisible <!--ax:KEY-->N<!--/ax--> marker; rewrite it from the live walk.
  //    Parity is enforced by pre-deploy.ts (12j). Config: scripts/doc-stats.js.
  const docValues = docStatValues(statsData);
  for (const { file: relPath, markers: spec } of DOC_STAT_FILES) {
    const docPath = path.join(root, relPath);
    if (!fs.existsSync(docPath)) {
      throw new Error(
        `Doc-stat file not found: ${relPath} — fix the path in scripts/doc-stats.js (DOC_STAT_FILES).`
      );
    }
    const original = fs.readFileSync(docPath, 'utf8');
    const problems = checkMarkerSpec(original, spec);
    if (problems.length) {
      throw new Error(
        `${relPath} doc-stat markers don't match their spec — ${problems.join('; ')}. ` +
        `Restore the markers around its counts, or update its entry in scripts/doc-stats.js.`
      );
    }
    const { content: rewritten } = applyDocStats(original, docValues);
    if (rewritten !== original) {
      updates.push({ path: docPath, content: rewritten, label: relPath });
    }
  }

  // --tag preflight: refuse on dirty tree (other than expected files) or existing tag
  if (tagFlag) {
    const expectedRelative = new Set(updates.map(u => path.relative(root, u.path)));
    let status;
    try {
      status = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' });
    } catch (err) {
      throw new Error(`--tag requires a git repository: ${err.message}`);
    }
    const dirtyFiles = status.split('\n').filter(Boolean).map(l => l.slice(3));
    // The Cursor AND Codex distributions are regenerated below, after these writes,
    // so the preflight would otherwise refuse on output this script is about to
    // produce itself. Only paths those two builds own are absolved; everything else
    // still blocks. (Codex joined this carve-out on 2026-09-05, when set-version
    // started regenerating it — before that it was correctly treated as a sibling.)
    const unexpected = dirtyFiles.filter(
      (f) => !expectedRelative.has(f) && !isCursorGeneratedPath(f) && !isCodexGeneratedPath(f),
    );
    if (unexpected.length) {
      throw new Error(
        `--tag refused: working tree has unrelated changes. Commit or stash them first:\n  ` +
        unexpected.join('\n  ')
      );
    }

    let tagExists = false;
    try {
      execSync(`git rev-parse --verify --quiet refs/tags/v${version}`, { cwd: root, stdio: 'pipe' });
      tagExists = true;
    } catch {
      // Tag doesn't exist — proceed
    }
    if (tagExists) {
      throw new Error(`--tag refused: tag v${version} already exists locally. Delete with: git tag -d v${version}`);
    }
  }

  // Write all files atomically (write to temp, then rename)
  const tempFiles = [];
  try {
    for (const update of updates) {
      const tempPath = update.path + '.tmp';
      tempFiles.push(tempPath);
      fs.writeFileSync(tempPath, update.content);
    }

    // All writes succeeded, now rename atomically
    for (let i = 0; i < updates.length; i++) {
      fs.renameSync(tempFiles[i], updates[i].path);
    }
  } catch (err) {
    // Cleanup temp files on failure
    for (const tempFile of tempFiles) {
      try { fs.unlinkSync(tempFile); } catch {}
    }
    throw err;
  }

  // Cursor and Codex variants embed the version in their own plugin manifests, so
  // both go stale on a bump and would ship version-mismatched. Keep these after the
  // atomic canonical writes: a generation failure leaves a truthful diagnostic
  // rather than silently shipping a stale variant.
  //
  // Codex was previously omitted here. Nothing caught it: pre-deploy's Codex
  // staleness gate (12f) compares skill/agent mtimes against the manifest, and a
  // pure version bump touches neither — so `axiom-codex/.codex-plugin/plugin.json`
  // sat at the OLD version through a fully green `npm test`. Verified 2026-09-05 by
  // reverting the manifest to the prior version and watching Phase 1 pass.
  for (const [label, script] of [['Cursor', 'build-cursor.ts'], ['Codex', 'build-codex.ts']]) {
    try {
      execSync(`node scripts/${script}`, { cwd: root, stdio: 'inherit' });
    } catch (err) {
      throw new Error(`canonical version changed but ${label} output is stale: ${err.message}`);
    }
  }

  // Create annotated tag (after successful writes) if --tag passed
  if (tagFlag) {
    try {
      execSync(`git tag -a v${version} -m "Axiom v${version}"`, { cwd: root, stdio: 'pipe' });
    } catch (err) {
      throw new Error(`Failed to create tag v${version}: ${err.message}`);
    }
  }

  // Success - print summary
  console.log(`✓ Version set to ${version}`);
  console.log(`  Skills: ${skillsCount} (${disciplineCount} discipline, ${referenceCount} reference, ${diagnosticCount} diagnostic)${suiteCount > 0 ? ` across ${suiteCount} skill suite(s)` : ''}`);
  console.log(`  Agents: ${agentsCount}`);
  console.log(`  Commands: ${commandsCount}`);
  console.log();
  console.log('Updated:');
  for (const update of updates) {
    console.log(`  ✓ ${update.label}`);
  }
  if (tagFlag) {
    console.log(`  ✓ Annotated git tag v${version} (local only, not pushed)`);
  }

} catch (err) {
  console.error(`❌ Error: ${err.message}`);
  process.exit(1);
}
