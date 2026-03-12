/**
 * Skill validation data — drives badges on doc pages and the /guide/quality page.
 *
 * Only skills that have been formally validated are listed here.
 * `grade` is optional — omit for skills that are tested but not graded.
 */

export interface SkillValidation {
  /** Letter grade: 'A+', 'A', 'A-', 'B+', etc. */
  grade?: string
  /** Month validation was completed: 'YYYY-MM' */
  date: string
  /** Number of pressure scenarios passed */
  pressureScenarios: number
}

export const validatedSkills: Record<string, SkillValidation> = {
  'swiftui-architecture': { grade: 'A+', date: '2025-12', pressureScenarios: 9 },
  'extensions-widgets': { grade: 'A+', date: '2025-12', pressureScenarios: 3 },
  'combine-patterns': { grade: 'A-', date: '2026-03', pressureScenarios: 3 },
  'xcode-debugging': { date: '2025-11', pressureScenarios: 3 },
  'swift-concurrency': { date: '2025-11', pressureScenarios: 3 },
  'database-migration': { date: '2025-11', pressureScenarios: 3 },
  'memory-debugging': { date: '2025-11', pressureScenarios: 3 },
  'build-debugging': { date: '2025-11', pressureScenarios: 3 },
  'performance-profiling': { date: '2025-11', pressureScenarios: 3 },
  'now-playing': { date: '2025-12', pressureScenarios: 2 },
  'liquid-glass': { date: '2026-01', pressureScenarios: 3 },
  'foundation-models': { date: '2026-01', pressureScenarios: 3 },
  'networking': { date: '2025-12', pressureScenarios: 3 },
  'swiftui-layout': { date: '2025-12', pressureScenarios: 3 },
  'swiftui-nav': { date: '2025-12', pressureScenarios: 3 },
  'objc-block-retain-cycles': { date: '2025-11', pressureScenarios: 3 },
  'uikit-animation-debugging': { date: '2025-11', pressureScenarios: 3 },
}

/** Aggregate stats for the quality page */
export function getValidationStats() {
  const skills = Object.values(validatedSkills)
  const totalScenarios = skills.reduce((sum, s) => sum + s.pressureScenarios, 0)
  const graded = skills.filter(s => s.grade)

  return {
    totalSkills: skills.length,
    totalScenarios,
    gradedSkills: graded.length,
    highestGrade: 'A+',
  }
}

/** Format 'YYYY-MM' to readable 'Mon YYYY' */
export function formatDate(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(month) - 1]} ${year}`
}
