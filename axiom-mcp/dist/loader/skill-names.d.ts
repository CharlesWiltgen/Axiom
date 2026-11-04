type NameSet = {
    has(name: string): boolean;
    keys(): Iterable<string>;
};
/**
 * Map the names a model actually uses to a served skill id. Sub-skills are
 * served as `<suite>--<file>`, but harnesses that load the native skills see
 * them as `skills/<file>.md` paths, and skill text cites them as
 * `<suite> (skills/<file>.md)` or by bare basename. `<suite>:<file>` and
 * `<suite>.<file>` resolve too. A bare basename resolves
 * only when exactly one suite has it.
 */
export declare function resolveSkillName(name: string, known: NameSet): string | undefined;
/** Whether the name asks for an audit, as Codex's `axiom-audit-<x>` skill names do. Scoring ignores these tokens. */
export declare function asksForAudit(name: string): boolean;
/** Candidates sharing the most name tokens with `name`, an exact token outscoring a prefix, shortest first. */
export declare function suggestNames(name: string, candidates: Iterable<string>, limit: number): string[];
export {};
