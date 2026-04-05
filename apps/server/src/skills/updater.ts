import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

interface SkillLearning {
  skill: string;
  entry: string;
  type: 'success' | 'failure' | 'workaround' | 'selector_update';
}

export function updateSkill(learning: SkillLearning): { ok: boolean; message: string } {
  const skillPath = join(__dirname, `${learning.skill}.md`);

  if (!existsSync(skillPath)) {
    // Create a new skill file
    const content = `# ${learning.skill.charAt(0).toUpperCase() + learning.skill.slice(1)} Skill\n\n## Learned\n\n${formatEntry(learning)}\n`;
    writeFileSync(skillPath, content, 'utf-8');
    return { ok: true, message: `Created new skill '${learning.skill}' with initial learning.` };
  }

  // Append to the existing skill file
  let content = readFileSync(skillPath, 'utf-8');

  // Find or create the "## Learned" section
  if (!content.includes('## Learned')) {
    content += '\n\n## Learned\n';
  }

  const entry = formatEntry(learning);
  const learnedIdx = content.indexOf('## Learned');
  const afterHeader = content.indexOf('\n', learnedIdx) + 1;

  content = content.slice(0, afterHeader) + '\n' + entry + '\n' + content.slice(afterHeader);

  writeFileSync(skillPath, content, 'utf-8');
  return { ok: true, message: `Updated skill '${learning.skill}' with new learning.` };
}

function formatEntry(learning: SkillLearning): string {
  const date = new Date().toISOString().split('T')[0];
  const typeLabel = {
    success: 'WORKED',
    failure: 'FAILED',
    workaround: 'WORKAROUND',
    selector_update: 'SELECTOR UPDATE',
  }[learning.type];

  return `- [${typeLabel}] (${date}) ${learning.entry}`;
}
