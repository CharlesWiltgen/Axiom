export function makeSkill(overrides) {
    return {
        description: '',
        content: '',
        skillType: 'discipline',
        source: 'axiom',
        tags: [],
        related: [],
        sections: [],
        ...overrides,
    };
}
export function makeAgent(overrides) {
    return {
        description: '',
        content: '',
        ...overrides,
    };
}
