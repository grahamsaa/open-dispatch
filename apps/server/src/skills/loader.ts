import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

interface Skill {
  name: string;
  content: string;
  triggers: RegExp;
}

const skills: Skill[] = [];

// Load all .md files from the skills directory
try {
  const files = readdirSync(__dirname).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const name = basename(file, '.md');
    const content = readFileSync(join(__dirname, file), 'utf-8');
    const triggers = buildTriggers(name, content);
    skills.push({ name, content, triggers });
  }
} catch (err) {
  console.error('Failed to load skills:', err);
}

function buildTriggers(name: string, content: string): RegExp {
  // Build a regex from the skill name + common keywords from the content
  const patterns: string[] = [name];

  // Extract key terms from the skill's first heading and setup section
  const knownTriggers: Record<string, string[]> = {
    gmail: ['gmail', 'e-?mails?', 'inbox', 'mail\\.google', 'messages?\\s+from'],
    chase: ['chase', 'chase\\.com', 'bank\\s+statement', 'credit\\s+card\\s+statement', 'chase\\s+account'],
  };

  if (knownTriggers[name]) {
    patterns.push(...knownTriggers[name]);
  }

  return new RegExp(`\\b(${patterns.join('|')})\\b`, 'i');
}

export function getRelevantSkills(text: string): string[] {
  const matched: string[] = [];
  for (const skill of skills) {
    if (skill.triggers.test(text)) {
      matched.push(skill.content);
    }
  }
  return matched;
}

export function listSkills(): Array<{ name: string; triggerPattern: string }> {
  return skills.map(s => ({ name: s.name, triggerPattern: s.triggers.source }));
}
