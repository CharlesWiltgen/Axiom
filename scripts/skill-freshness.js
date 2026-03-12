#!/usr/bin/env node
/**
 * Skill Freshness Audit
 *
 * Scans all skills and reports which ones may be stale based on
 * git history (last modification date of SKILL.md).
 *
 * Usage:
 *   node scripts/skill-freshness.js           # Default: 6 month threshold
 *   node scripts/skill-freshness.js --months=3  # Custom threshold
 *   node scripts/skill-freshness.js --all       # Show all skills, not just stale
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');
const skillsDir = path.join(root, '.claude-plugin/plugins/axiom/skills');

// Parse args
const args = process.argv.slice(2);
const monthsArg = args.find(a => a.startsWith('--months='));
const threshold = monthsArg ? parseInt(monthsArg.split('=')[1]) : 6;
const showAll = args.includes('--all');

// Calculate cutoff date
const now = new Date();
const cutoff = new Date(now);
cutoff.setMonth(cutoff.getMonth() - threshold);
const cutoffYYYYMM = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`;

// Categorize skills by type based on name suffix
function skillType(name) {
  if (name.endsWith('-diag')) return 'diagnostic';
  if (name.endsWith('-ref')) return 'reference';
  if (name.startsWith('axiom-ios-') && !name.endsWith('-ref') && !name.endsWith('-diag')) return 'router';
  if (name === 'axiom-using-axiom' || name === 'axiom-getting-started' ||
      name === 'axiom-apple-docs' || name === 'axiom-shipping' ||
      name === 'axiom-xcode-mcp' || name === 'axiom-ios-ml' ||
      name === 'axiom-ios-games' || name === 'axiom-ios-graphics') return 'router';
  return 'discipline';
}

// Get last modification date from git
function getLastModified(skillDir) {
  const skillFile = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillFile)) return null;

  try {
    const date = execSync(
      `git log -1 --format=%cd --date=format:'%Y-%m' -- "${skillFile}"`,
      { cwd: root, encoding: 'utf-8' }
    ).trim().replace(/'/g, '');
    return date || null;
  } catch {
    return null;
  }
}

// Months between two YYYY-MM strings
function monthsBetween(a, b) {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

const nowYYYYMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

// Scan all skills
const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name.startsWith('axiom-'))
  .map(d => {
    const name = d.name;
    const lastMod = getLastModified(path.join(skillsDir, name));
    const type = skillType(name);
    const age = lastMod ? monthsBetween(lastMod, nowYYYYMM) : null;
    const stale = age !== null && age >= threshold;
    return { name, type, lastMod, age, stale };
  })
  .sort((a, b) => {
    // Sort: stale first (oldest first), then fresh (oldest first)
    if (a.stale !== b.stale) return a.stale ? -1 : 1;
    if (a.age !== b.age) return (b.age ?? 999) - (a.age ?? 999);
    return a.name.localeCompare(b.name);
  });

const stale = entries.filter(e => e.stale);
const neverTracked = entries.filter(e => e.lastMod === null);
const fresh = entries.filter(e => !e.stale && e.lastMod !== null);

// Format output
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(yyyyMm) {
  if (!yyyyMm) return 'never';
  const [y, m] = yyyyMm.split('-');
  return `${months[parseInt(m) - 1]} ${y}`;
}

function fmtAge(age) {
  if (age === null) return '';
  if (age === 0) return 'this month';
  if (age === 1) return '1 month ago';
  return `${age} months ago`;
}

// Print report
console.log(`\nSkill Freshness Report`);
console.log(`Threshold: ${threshold} months (cutoff: ${fmtDate(cutoffYYYYMM)})`);
console.log(`Scanned: ${entries.length} skills\n`);

if (stale.length > 0) {
  console.log(`⚠️  STALE (>${threshold} months since last change): ${stale.length} skills`);
  console.log('─'.repeat(70));
  for (const s of stale) {
    const shortName = s.name.replace('axiom-', '');
    console.log(`  ${shortName.padEnd(40)} ${fmtDate(s.lastMod).padEnd(12)} (${fmtAge(s.age)})`);
  }
  console.log();
}

if (neverTracked.length > 0) {
  console.log(`❓ NO GIT HISTORY: ${neverTracked.length} skills`);
  console.log('─'.repeat(70));
  for (const s of neverTracked) {
    const shortName = s.name.replace('axiom-', '');
    console.log(`  ${shortName}`);
  }
  console.log();
}

if (showAll && fresh.length > 0) {
  console.log(`✅ FRESH (within ${threshold} months): ${fresh.length} skills`);
  console.log('─'.repeat(70));
  for (const s of fresh) {
    const shortName = s.name.replace('axiom-', '');
    console.log(`  ${shortName.padEnd(40)} ${fmtDate(s.lastMod).padEnd(12)} (${fmtAge(s.age)})`);
  }
  console.log();
}

// Summary
console.log('─'.repeat(70));
console.log(`Summary: ${stale.length} stale · ${neverTracked.length} untracked · ${fresh.length} fresh`);

if (stale.length === 0 && neverTracked.length === 0) {
  console.log('✅ All skills are fresh!\n');
} else {
  console.log();
}
