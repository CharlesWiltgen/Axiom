#!/usr/bin/env node

/**
 * Generates Mermaid diagram blocks for Axiom's skill map documentation.
 *
 * Usage:
 *   node scripts/generate-skill-diagrams.js           # Print all diagrams
 *   node scripts/generate-skill-diagrams.js --check    # Verify docs are up-to-date
 *   node scripts/generate-skill-diagrams.js --overview  # Print only the overview mindmap
 *   node scripts/generate-skill-diagrams.js --domain <name>  # Print one domain flowchart
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SKILLS_DIR = path.join(__dirname, '..', '.claude-plugin', 'plugins', 'axiom', 'skills')
const AGENTS_DIR = path.join(__dirname, '..', '.claude-plugin', 'plugins', 'axiom', 'agents')
const COMMANDS_DIR = path.join(__dirname, '..', '.claude-plugin', 'plugins', 'axiom', 'commands')
const DOCS_DIR = path.join(__dirname, '..', 'docs')

const ROUTER_NAMES = [
  'axiom-ios-build',
  'axiom-ios-ui',
  'axiom-ios-data',
  'axiom-ios-concurrency',
  'axiom-ios-performance',
  'axiom-ios-testing',
  'axiom-ios-networking',
  'axiom-ios-integration',
  'axiom-ios-accessibility',
  'axiom-ios-ai',
  'axiom-ios-vision',
  'axiom-ios-graphics',
  'axiom-ios-games',
  'axiom-ios-ml',
  'axiom-apple-docs',
  'axiom-shipping',
  'axiom-xcode-mcp',
]

// Map routers to doc category pages
const ROUTER_TO_CATEGORY = {
  'axiom-ios-ui': 'docs/skills/ui-design/index.md',
  'axiom-ios-build': 'docs/skills/debugging/index.md',
  'axiom-ios-performance': 'docs/skills/debugging/index.md',
  'axiom-ios-concurrency': 'docs/skills/concurrency/index.md',
  'axiom-ios-data': 'docs/skills/persistence/index.md',
  'axiom-ios-integration': 'docs/skills/integration/index.md',
  'axiom-ios-testing': 'docs/skills/testing/index.md',
  'axiom-ios-games': 'docs/skills/games/index.md',
  'axiom-shipping': 'docs/skills/shipping/index.md',
  'axiom-xcode-mcp': 'docs/skills/xcode-mcp/index.md',
}

// Friendly display names for routers
const ROUTER_DISPLAY = {
  'axiom-ios-build': 'Build & Environment',
  'axiom-ios-ui': 'UI & Design',
  'axiom-ios-data': 'Data & Persistence',
  'axiom-ios-concurrency': 'Concurrency',
  'axiom-ios-performance': 'Performance',
  'axiom-ios-testing': 'Testing',
  'axiom-ios-networking': 'Networking',
  'axiom-ios-integration': 'Integration',
  'axiom-ios-accessibility': 'Accessibility',
  'axiom-ios-ai': 'Apple Intelligence',
  'axiom-ios-vision': 'Computer Vision',
  'axiom-ios-graphics': 'Graphics & 3D',
  'axiom-ios-games': 'Games',
  'axiom-ios-ml': 'Machine Learning',
  'axiom-apple-docs': 'Apple Docs',
  'axiom-shipping': 'Shipping',
  'axiom-xcode-mcp': 'Xcode MCP',
}

function parseRouter(routerName) {
  const skillPath = path.join(SKILLS_DIR, routerName, 'SKILL.md')
  if (!fs.existsSync(skillPath)) return null

  const content = fs.readFileSync(skillPath, 'utf-8')

  // Extract skill references from multiple patterns:
  // - `/skill axiom-*` or `/skill <name>` (some routers omit axiom- prefix)
  // - `Read the axiom-* skill`
  // - `Invoke: axiom-*`
  // - backtick-wrapped `axiom-*` skill references
  const skillRefs = new Set()
  const skillPatterns = [
    /\/skill axiom-([a-z0-9-]+)/g,
    /\/skill ([a-z][a-z0-9-]+)/g,
    /Read the [`"]?axiom-([a-z0-9-]+)[`"]? skill/gi,
    /Invoke:?\s*(?:Read the\s+)?(?:`)?axiom-([a-z0-9-]+)(?:`)?/gi,
    /uses axiom-([a-z0-9-]+)/gi,
  ]
  let match
  for (const regex of skillPatterns) {
    while ((match = regex.exec(content)) !== null) {
      // Normalize: remove axiom- prefix if present, we'll display without it
      const name = match[1].replace(/^axiom-/, '')
      skillRefs.add(name)
    }
  }
  // Remove the router's own name if accidentally captured
  const ownName = routerName.replace(/^axiom-/, '')
  skillRefs.delete(ownName)

  // Extract agent references: Launch `agent-name` agent or → agent-name (Agent)
  const agentRefs = new Set()
  const agentRegex1 = /Launch [`"]?([a-z-]+)[`"]? agent/gi
  const agentRegex2 = /→\s*([a-z-]+)\s*\(Agent\)/gi
  while ((match = agentRegex1.exec(content)) !== null) {
    agentRefs.add(match[1])
  }
  while ((match = agentRegex2.exec(content)) !== null) {
    agentRefs.add(match[1])
  }

  // Extract command references: /axiom:*
  const cmdRefs = new Set()
  const cmdRegex = /\/axiom:([a-z-]+(?:\s[a-z-]+)?)/g
  while ((match = cmdRegex.exec(content)) !== null) {
    cmdRefs.add(match[1])
  }

  return {
    name: routerName,
    displayName: ROUTER_DISPLAY[routerName] || routerName,
    skills: [...skillRefs],
    agents: [...agentRefs],
    commands: [...cmdRefs],
  }
}

function classifySkill(name) {
  if (name.endsWith('-ref')) return 'reference'
  if (name.endsWith('-diag')) return 'diagnostic'
  return 'discipline'
}

function sanitizeId(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '_')
}

function generateOverviewMindmap(routers) {
  const lines = ['mindmap', '  root((Axiom))']

  for (const router of routers) {
    // Skip apple-docs — too many items, not useful in mindmap
    if (router.name === 'axiom-apple-docs') continue

    const displayName = router.displayName
    const skillCount = router.skills.length
    const agentCount = router.agents.length
    const totalItems = skillCount + agentCount

    lines.push(`    ${displayName}`)

    // Group skills by type
    const disciplines = router.skills.filter(s => classifySkill(s) === 'discipline')
    const references = router.skills.filter(s => classifySkill(s) === 'reference')
    const diagnostics = router.skills.filter(s => classifySkill(s) === 'diagnostic')

    if (disciplines.length > 0) {
      lines.push(`      ${disciplines.length} discipline skills`)
    }
    if (references.length > 0) {
      lines.push(`      ${references.length} reference skills`)
    }
    if (diagnostics.length > 0) {
      lines.push(`      ${diagnostics.length} diagnostic skills`)
    }
    if (agentCount > 0) {
      lines.push(`      ${agentCount} agents`)
    }
    if (router.commands.length > 0) {
      lines.push(`      ${router.commands.length} commands`)
    }
  }

  // Add apple-docs as a summary node
  const appleDocs = routers.find(r => r.name === 'axiom-apple-docs')
  if (appleDocs) {
    lines.push(`    Apple Docs`)
    lines.push(`      20 Apple guides`)
    lines.push(`      32 Swift diagnostics`)
  }

  return lines.join('\n')
}

function generateDomainFlowchart(router) {
  const lines = []
  const routerId = sanitizeId(router.name)

  lines.push('flowchart LR')

  // Style definitions
  lines.push('    classDef router fill:#6f42c1,stroke:#5a32a3,color:#fff')
  lines.push('    classDef discipline fill:#d4edda,stroke:#28a745,color:#1b4332')
  lines.push('    classDef reference fill:#cce5ff,stroke:#0d6efd,color:#003366')
  lines.push('    classDef diagnostic fill:#fff3cd,stroke:#ffc107,color:#664d03')
  lines.push('    classDef agent fill:#f8d7da,stroke:#dc3545,color:#58151c')
  lines.push('    classDef command fill:#e2e3e5,stroke:#6c757d,color:#383d41')
  lines.push('')

  // Router node
  lines.push(`    ${routerId}["${router.displayName}"]:::router`)
  lines.push('')

  // Group skills by type
  const disciplines = router.skills.filter(s => classifySkill(s) === 'discipline')
  const references = router.skills.filter(s => classifySkill(s) === 'reference')
  const diagnostics = router.skills.filter(s => classifySkill(s) === 'diagnostic')

  // Discipline skills subgraph
  if (disciplines.length > 0) {
    lines.push(`    subgraph skills_d["Skills"]`)
    for (const skill of disciplines) {
      const id = sanitizeId(skill)
      const label = skill
      lines.push(`        ${id}["${label}"]:::discipline`)
    }
    lines.push('    end')
    lines.push(`    ${routerId} --> skills_d`)
    lines.push('')
  }

  // Reference skills subgraph
  if (references.length > 0) {
    lines.push(`    subgraph skills_r["References"]`)
    for (const skill of references) {
      const id = sanitizeId(skill)
      const label = skill
      lines.push(`        ${id}["${label}"]:::reference`)
    }
    lines.push('    end')
    lines.push(`    ${routerId} --> skills_r`)
    lines.push('')
  }

  // Diagnostic skills subgraph
  if (diagnostics.length > 0) {
    lines.push(`    subgraph skills_diag["Diagnostics"]`)
    for (const skill of diagnostics) {
      const id = sanitizeId(skill)
      const label = skill
      lines.push(`        ${id}["${label}"]:::diagnostic`)
    }
    lines.push('    end')
    lines.push(`    ${routerId} --> skills_diag`)
    lines.push('')
  }

  // Agents subgraph
  if (router.agents.length > 0) {
    lines.push(`    subgraph agents_sg["Agents"]`)
    for (const agent of router.agents) {
      const id = `agent_${sanitizeId(agent)}`
      lines.push(`        ${id}["${agent}"]:::agent`)
    }
    lines.push('    end')
    lines.push(`    ${routerId} --> agents_sg`)
    lines.push('')
  }

  // Commands subgraph
  if (router.commands.length > 0) {
    lines.push(`    subgraph cmds_sg["Commands"]`)
    for (const cmd of router.commands) {
      const id = `cmd_${sanitizeId(cmd)}`
      lines.push(`        ${id}["/axiom:${cmd}"]:::command`)
    }
    lines.push('    end')
    lines.push(`    ${routerId} --> cmds_sg`)
    lines.push('')
  }

  return lines.join('\n')
}

function countTotals(routers) {
  const allSkills = new Set()
  const allAgents = new Set()
  const allCommands = new Set()

  for (const router of routers) {
    router.skills.forEach(s => allSkills.add(s))
    router.agents.forEach(a => allAgents.add(a))
    router.commands.forEach(c => allCommands.add(c))
  }

  // Count actual skill directories (not just router-referenced ones)
  const skillDirs = fs.readdirSync(SKILLS_DIR).filter(d => {
    const stat = fs.statSync(path.join(SKILLS_DIR, d))
    return stat.isDirectory() && fs.existsSync(path.join(SKILLS_DIR, d, 'SKILL.md'))
  })

  const agentFiles = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'))
  const commandFiles = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md'))

  return {
    skills: skillDirs.length,
    agents: agentFiles.length,
    commands: commandFiles.length,
    routers: ROUTER_NAMES.length,
    uniqueRoutedSkills: allSkills.size,
    uniqueRoutedAgents: allAgents.size,
  }
}

function routerSummaryRow(r) {
  const d = r.skills.filter(s => classifySkill(s) === 'discipline').length
  const ref = r.skills.filter(s => classifySkill(s) === 'reference').length
  const diag = r.skills.filter(s => classifySkill(s) === 'diagnostic').length
  const parts = []
  if (d) parts.push(d + ' discipline')
  if (ref) parts.push(ref + ' reference')
  if (diag) parts.push(diag + ' diagnostic')
  if (r.agents.length) parts.push(r.agents.length + ' agents')
  if (r.commands.length) parts.push(r.commands.length + ' commands')
  return '| **' + r.displayName + '** | ' + parts.join(', ') + ' |'
}

function generateOverviewPage(routers) {
  const totals = countTotals(routers)
  const mindmap = generateOverviewMindmap(routers)

  const tableRows = routers
    .filter(r => r.name !== 'axiom-apple-docs')
    .map(routerSummaryRow)
    .join('\n')

  const lines = [
    '# Skill Map',
    '',
    'Visual overview of Axiom\'s two-layer routing architecture. ' + totals.routers + ' routers organize ' + totals.skills + ' skills, ' + totals.agents + ' agents, and ' + totals.commands + ' commands into discoverable domains.',
    '',
    '## How It Works',
    '',
    'Axiom uses **progressive disclosure** — you never need to memorize skill names. Ask a question, and the right router activates automatically:',
    '',
    '1. **Your question** hits one of ' + totals.routers + ' domain routers',
    '2. The **router** selects the right specialized skill, agent, or command',
    '3. You get **expert guidance** tailored to your specific issue',
    '',
    '## Color Legend',
    '',
    '| Type | Role | Example |',
    '|------|------|---------|',
    '| <span style="background:#6f42c1;color:#fff;padding:2px 8px;border-radius:4px">Router</span> | Domain entry point | ios-ui, ios-data |',
    '| <span style="background:#d4edda;color:#1b4332;padding:2px 8px;border-radius:4px">Discipline</span> | Workflow + best practices | swift-concurrency, liquid-glass |',
    '| <span style="background:#cce5ff;color:#003366;padding:2px 8px;border-radius:4px">Reference</span> | Complete API guide | network-framework-ref, storekit-ref |',
    '| <span style="background:#fff3cd;color:#664d03;padding:2px 8px;border-radius:4px">Diagnostic</span> | Troubleshooting trees | networking-diag, energy-diag |',
    '| <span style="background:#f8d7da;color:#58151c;padding:2px 8px;border-radius:4px">Agent</span> | Autonomous scanner | memory-auditor, build-fixer |',
    '| <span style="background:#e2e3e5;color:#383d41;padding:2px 8px;border-radius:4px">Command</span> | Explicit invocation | /axiom:fix-build, /axiom:audit |',
    '',
    '## Overview',
    '',
    '```mermaid',
    mindmap,
    '```',
    '',
    '## Domain Breakdown',
    '',
    '| Domain | Contents |',
    '|--------|----------|',
    tableRows,
    '',
    '**Apple Docs** provides access to 20 official Apple guides and 32 Swift compiler diagnostics bundled in Xcode.',
    '',
    '## Counts',
    '',
    '| Category | Count |',
    '|----------|-------|',
    '| Routers | ' + totals.routers + ' |',
    '| Skills | ' + totals.skills + ' |',
    '| Agents | ' + totals.agents + ' |',
    '| Commands | ' + totals.commands + ' |',
    '',
  ]

  return lines.join('\n')
}

function checkDiagrams(routers) {
  const skillMapPath = path.join(DOCS_DIR, 'guide', 'skill-map.md')
  let errors = 0

  if (!fs.existsSync(skillMapPath)) {
    console.error('MISSING: docs/guide/skill-map.md')
    errors++
  }

  for (const [routerName, docPath] of Object.entries(ROUTER_TO_CATEGORY)) {
    const fullPath = path.join(__dirname, '..', docPath)
    if (!fs.existsSync(fullPath)) {
      console.error('MISSING: ' + docPath)
      errors++
      continue
    }
    const content = fs.readFileSync(fullPath, 'utf-8')
    if (!content.includes('```mermaid')) {
      console.error('NO DIAGRAM: ' + docPath + ' (expected mermaid block for ' + routerName + ')')
      errors++
    }
  }

  if (errors === 0) {
    console.log('All diagrams present and accounted for.')
  }
  return errors
}

// Main
const args = process.argv.slice(2)
const routers = ROUTER_NAMES.map(parseRouter).filter(Boolean)

if (args.includes('--check')) {
  const errors = checkDiagrams(routers)
  process.exit(errors > 0 ? 1 : 0)
} else if (args.includes('--overview')) {
  console.log(generateOverviewMindmap(routers))
} else if (args.includes('--domain')) {
  const idx = args.indexOf('--domain')
  const name = args[idx + 1]
  if (!name || name.startsWith('--')) {
    console.error('Usage: --domain <router-name>')
    process.exit(1)
  }
  const router = routers.find(r => r.name === name || r.name === 'axiom-' + name || r.name === 'axiom-ios-' + name)
  if (!router) {
    console.error('Router not found: ' + name)
    process.exit(1)
  }
  console.log(generateDomainFlowchart(router))
} else if (args.includes('--page')) {
  console.log(generateOverviewPage(routers))
} else if (args.includes('--json')) {
  console.log(JSON.stringify(routers, null, 2))
} else {
  // Default: print everything
  console.log('=== OVERVIEW MINDMAP ===\n')
  console.log(generateOverviewMindmap(routers))
  console.log('\n')
  for (const router of routers) {
    if (router.name === 'axiom-apple-docs') continue
    console.log('=== ' + router.displayName.toUpperCase() + ' ===\n')
    console.log(generateDomainFlowchart(router))
    console.log('\n')
  }
}
