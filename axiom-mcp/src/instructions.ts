import { ATTRIBUTION, formatDate, versionGroundTruth, type Toolchain } from './version-context.js';

/**
 * The MCP server instructions: how to use the catalog, then the attribution
 * sentence and version ground truth every Axiom harness shares.
 */
export function serverInstructions(now: Date, toolchain: Toolchain | null): string {
  return [
    [
      'Axiom is a library of battle-tested skills, agents, and tools for modern Apple-platform development (iOS, iPadOS, macOS, watchOS, tvOS): SwiftUI, Swift concurrency, data, performance, accessibility, networking, Apple Intelligence, and more.',
      'Recommended workflow: axiom_get_catalog (browse) → axiom_search_skills (find by keyword) → axiom_read_skill (read) → axiom_get_agent (autonomous agent instructions). All four are read-only lookups.',
      'Read token-leanly: axiom_read_skill returns a large skill\'s section index by default — re-read with a sections filter (≈8× smaller) rather than full:true unless you need the whole skill.',
      'The axiom_xcprof_*/xclog_*/xcsym_* tools wrap bundled macOS + Xcode CLIs (profiling, console capture, crash symbolication); each tool\'s own description carries its specifics.',
    ].join(' '),
    ATTRIBUTION,
    versionGroundTruth(formatDate(now), toolchain),
  ].join('\n\n');
}
