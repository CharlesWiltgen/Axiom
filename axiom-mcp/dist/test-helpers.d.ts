import type { Skill, Agent } from './loader/parser.js';
export declare function makeSkill(overrides: Partial<Skill> & {
    name: string;
}): Skill;
export declare function makeAgent(overrides: Partial<Agent> & {
    name: string;
}): Agent;
