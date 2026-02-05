import type { Skill, Agent } from './loader/parser.js';

export function makeSkill(overrides: Partial<Skill> & { name: string }): Skill {
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

export function makeAgent(overrides: Partial<Agent> & { name: string }): Agent {
  return {
    description: '',
    content: '',
    ...overrides,
  };
}
