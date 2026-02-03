import { Skill, Agent } from '../loader/parser.js';

/**
 * Categories derived from the 13 router skills.
 * Each maps a router name to a human-readable category label.
 */
const ROUTER_CATEGORIES: Record<string, string> = {
  'axiom-ios-build': 'Build & Environment',
  'axiom-ios-ui': 'UI & Design',
  'axiom-ios-data': 'Data & Persistence',
  'axiom-ios-concurrency': 'Concurrency & Async',
  'axiom-ios-performance': 'Performance',
  'axiom-ios-networking': 'Networking',
  'axiom-ios-integration': 'System Integration',
  'axiom-ios-accessibility': 'Accessibility',
  'axiom-ios-ai': 'Apple Intelligence',
  'axiom-ios-ml': 'Machine Learning',
  'axiom-ios-vision': 'Computer Vision',
  'axiom-ios-graphics': 'Graphics & Metal',
  'axiom-ios-testing': 'Testing',
};

interface CatalogCategory {
  label: string;
  skills: { name: string; description: string; skillType: string; source: string }[];
}

export interface CatalogResult {
  categories: Record<string, CatalogCategory>;
  agents: { name: string; description: string }[];
  totalSkills: number;
  totalAgents: number;
}

/**
 * Extract skill names referenced in a router skill's content.
 * Looks for patterns like `/skill axiom-xxx` or `→ skill-name`
 */
function extractRouterReferences(content: string): string[] {
  const refs: string[] = [];

  // Match /skill axiom-xxx patterns
  const skillPattern = /\/skill\s+(axiom-[\w-]+)/g;
  let match;
  while ((match = skillPattern.exec(content)) !== null) {
    refs.push(match[1]);
  }

  return refs;
}

/**
 * Build a category map from router skills.
 * For each router, extract referenced skills and assign them to that category.
 */
function buildRouterCategoryMap(skills: Map<string, Skill>): Map<string, string> {
  const skillToCategory = new Map<string, string>();

  for (const [routerName, categoryLabel] of Object.entries(ROUTER_CATEGORIES)) {
    const router = skills.get(routerName);
    if (!router) continue;

    const refs = extractRouterReferences(router.content);
    for (const ref of refs) {
      if (skills.has(ref)) {
        skillToCategory.set(ref, categoryLabel);
      }
    }
  }

  return skillToCategory;
}

/**
 * Map Apple doc filename patterns to existing categories.
 */
const APPLE_DOC_CATEGORIES: Record<string, string> = {
  'swiftui': 'UI & Design',
  'uikit': 'UI & Design',
  'appkit': 'UI & Design',
  'widgetkit': 'System Integration',
  'swift-concurrency': 'Concurrency & Async',
  'swift-inlinearray': 'Performance',
  'swiftdata': 'Data & Persistence',
  'storekit': 'System Integration',
  'foundationmodels': 'Apple Intelligence',
  'appintents': 'System Integration',
  'mapkit': 'System Integration',
  'swift-charts': 'UI & Design',
  'implementing-visual': 'Computer Vision',
  'implementing-assistive': 'Accessibility',
  'widgets-for-visionos': 'System Integration',
  'foundation-attributedstring': 'UI & Design',
  'alarmkit': 'System Integration',
  'webkit': 'UI & Design',
  'toolbar': 'UI & Design',
  'styled-text': 'UI & Design',
  'liquid-glass': 'UI & Design',
};

/**
 * Infer category from skill name when no router reference exists.
 */
function inferCategoryFromName(name: string): string {
  // Apple diagnostics go to Build & Environment
  if (name.startsWith('apple-diag-')) return 'Build & Environment';

  // Apple guides: match against known patterns
  if (name.startsWith('apple-guide-')) {
    for (const [pattern, category] of Object.entries(APPLE_DOC_CATEGORIES)) {
      if (name.includes(pattern)) return category;
    }
    return 'General';
  }

  if (name.includes('build') || name.includes('xcode') || name.includes('spm')) return 'Build & Environment';
  if (name.includes('swiftui') || name.includes('uikit') || name.includes('layout') || name.includes('liquid-glass') || name.includes('hig') || name.includes('typography') || name.includes('textkit') || name.includes('animation') || name.includes('ui-recording') || name.includes('ui-testing')) return 'UI & Design';
  if (name.includes('data') || name.includes('sqlite') || name.includes('grdb') || name.includes('realm') || name.includes('codable') || name.includes('cloud') || name.includes('storage') || name.includes('migration') || name.includes('icloud')) return 'Data & Persistence';
  if (name.includes('concurrency') || name.includes('async') || name.includes('synchroniz') || name.includes('isolated')) return 'Concurrency & Async';
  if (name.includes('performance') || name.includes('energy') || name.includes('memory') || name.includes('profil') || name.includes('hang') || name.includes('display')) return 'Performance';
  if (name.includes('network') || name.includes('url')) return 'Networking';
  if (name.includes('accessibility')) return 'Accessibility';
  if (name.includes('test') || name.includes('xctest') || name.includes('xctrace') || name.includes('axe')) return 'Testing';
  if (name.includes('vision') || name.includes('photo') || name.includes('camera')) return 'Computer Vision';
  if (name.includes('foundation-model') || name.includes('intelligence')) return 'Apple Intelligence';
  if (name.includes('metal') || name.includes('graphics')) return 'Graphics & Metal';
  if (name.includes('debug')) return 'Build & Environment';
  if (name.includes('triage') || name.includes('app-store-connect')) return 'Build & Environment';
  if (name.includes('intent') || name.includes('shortcut') || name.includes('widget') || name.includes('extension') || name.includes('haptic') || name.includes('storekit') || name.includes('iap') || name.includes('now-playing') || name.includes('localization') || name.includes('spotlight') || name.includes('privacy') || name.includes('deep-link') || name.includes('app-store') || name.includes('background-process')) return 'System Integration';
  if (name.includes('docs-research') || name.includes('getting-started')) return 'General';
  return 'General';
}

/**
 * Build a structured catalog from skills and agents.
 * Router skills are excluded from the catalog output.
 */
export function buildCatalog(
  skills: Map<string, Skill>,
  agents: Map<string, Agent>,
  filterCategory?: string,
): CatalogResult {
  const routerCategoryMap = buildRouterCategoryMap(skills);
  const categories: Record<string, CatalogCategory> = {};
  let totalSkills = 0;

  for (const [name, skill] of skills) {
    // Exclude routers and meta skills from catalog
    if (skill.skillType === 'router' || skill.skillType === 'meta') continue;

    // Priority chain: router reference > name heuristic
    // Explicit mcp.category values from skill frontmatter are freeform labels
    // that don't match normalized catalog categories, so we skip them.
    const category = routerCategoryMap.get(name)
      || inferCategoryFromName(name);

    if (filterCategory && category !== filterCategory) continue;

    if (!categories[category]) {
      categories[category] = { label: category, skills: [] };
    }

    categories[category].skills.push({
      name: skill.name,
      description: skill.description,
      skillType: skill.skillType,
      source: skill.source || 'axiom',
    });
    totalSkills++;
  }

  // Sort skills within each category by name
  for (const cat of Object.values(categories)) {
    cat.skills.sort((a, b) => a.name.localeCompare(b.name));
  }

  const agentList = Array.from(agents.values())
    .map(a => ({ name: a.name, description: a.description }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    categories,
    agents: filterCategory ? [] : agentList,
    totalSkills,
    totalAgents: agents.size,
  };
}
