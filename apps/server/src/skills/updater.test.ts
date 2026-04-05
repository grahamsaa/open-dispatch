import { describe, it, expect, afterEach } from 'vitest';
import { updateSkill } from './updater.js';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const TEST_SKILL = '_test_skill_';
const testPath = join(__dirname, `${TEST_SKILL}.md`);

afterEach(() => {
  if (existsSync(testPath)) unlinkSync(testPath);
});

describe('updateSkill', () => {
  it('creates a new skill file if it does not exist', () => {
    const result = updateSkill({ skill: TEST_SKILL, entry: 'Selector .foo works for login button', type: 'success' });
    expect(result.ok).toBe(true);
    expect(existsSync(testPath)).toBe(true);

    const content = readFileSync(testPath, 'utf-8');
    expect(content).toContain('WORKED');
    expect(content).toContain('Selector .foo works');
  });

  it('appends to existing skill file', () => {
    updateSkill({ skill: TEST_SKILL, entry: 'First learning', type: 'success' });
    updateSkill({ skill: TEST_SKILL, entry: 'Second learning', type: 'failure' });

    const content = readFileSync(testPath, 'utf-8');
    expect(content).toContain('First learning');
    expect(content).toContain('Second learning');
    expect(content).toContain('WORKED');
    expect(content).toContain('FAILED');
  });

  it('includes date in entries', () => {
    updateSkill({ skill: TEST_SKILL, entry: 'Test entry', type: 'workaround' });
    const content = readFileSync(testPath, 'utf-8');
    const today = new Date().toISOString().split('T')[0];
    expect(content).toContain(today);
    expect(content).toContain('WORKAROUND');
  });

  it('handles selector_update type', () => {
    updateSkill({ skill: TEST_SKILL, entry: 'Old selector .bar replaced by .baz', type: 'selector_update' });
    const content = readFileSync(testPath, 'utf-8');
    expect(content).toContain('SELECTOR UPDATE');
  });

  it('appends to existing gmail skill without destroying it', () => {
    const gmailPath = join(__dirname, 'gmail.md');
    const before = readFileSync(gmailPath, 'utf-8');

    updateSkill({ skill: 'gmail', entry: 'Test learning - safe to remove', type: 'success' });

    const after = readFileSync(gmailPath, 'utf-8');
    // Original content should still be there
    expect(after).toContain('# Gmail Skill');
    expect(after).toContain('Test learning - safe to remove');

    // Restore original
    const { writeFileSync } = require('node:fs');
    writeFileSync(gmailPath, before, 'utf-8');
  });
});
