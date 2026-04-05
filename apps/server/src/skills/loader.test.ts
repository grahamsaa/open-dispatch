import { describe, it, expect } from 'vitest';
import { getRelevantSkills, listSkills } from './loader.js';

describe('skills loader', () => {
  it('lists available skills', () => {
    const skills = listSkills();
    expect(skills.length).toBeGreaterThan(0);
    const names = skills.map(s => s.name);
    expect(names).toContain('gmail');
    expect(names).toContain('chase');
  });

  it('matches gmail skill on "gmail" keyword', () => {
    const skills = getRelevantSkills('Go to Gmail and delete some emails');
    expect(skills.length).toBe(1);
    expect(skills[0]).toContain('Gmail Skill');
  });

  it('matches gmail skill on "email" keyword', () => {
    const skills = getRelevantSkills('Find emails from a specific sender');
    expect(skills.length).toBe(1);
    expect(skills[0]).toContain('Gmail Skill');
  });

  it('matches gmail skill on "inbox" keyword', () => {
    const skills = getRelevantSkills('Clean up my inbox');
    expect(skills.length).toBe(1);
  });

  it('matches chase skill on "chase" keyword', () => {
    const skills = getRelevantSkills('Download my Chase statements');
    expect(skills.length).toBe(1);
    expect(skills[0]).toContain('Chase Bank Skill');
  });

  it('matches chase on "bank statement" keyword', () => {
    const skills = getRelevantSkills('Get my bank statement for last month');
    expect(skills.length).toBe(1);
    expect(skills[0]).toContain('Chase');
  });

  it('returns empty for unrelated prompts', () => {
    const skills = getRelevantSkills('List files in ~/workspace');
    expect(skills.length).toBe(0);
  });

  it('can match multiple skills', () => {
    const skills = getRelevantSkills('Download my Chase bank statement and email it via Gmail');
    expect(skills.length).toBe(2);
  });
});
