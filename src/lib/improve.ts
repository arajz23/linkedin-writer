import { AI } from 'lua-cli';
import { activeNotes, exemplars, latestProfile } from './store';
import { RULES, WHO, lintPost } from '../knowledge/voice';
import { OWNER } from '../knowledge/owner';

// the owner writes a post himself; the agent makes it land, in his voice, without adding a single fact.
// Used by the dashboard's Write page (POST /improve) and by the improve_post chat tool.

export interface Improved {
  original: string;
  improved: string;
  hook: string;
  altHooks: string[];
  changes: string[];
  check?: string;
  lint: string[];
}

const schema = {
  type: 'object',
  properties: {
    improved: { type: 'string' },
    hook: { type: 'string' },
    altHooks: { type: 'array', items: { type: 'string' } },
    changes: { type: 'array', items: { type: 'string' } },
    check: { type: 'string' },
  },
  required: ['improved', 'hook', 'altHooks', 'changes'],
  additionalProperties: false,
};

export async function improvePost(text: string, steer?: string): Promise<Improved> {
  const [profile, notes, examples] = await Promise.all([latestProfile(), activeNotes(), exemplars(4, 800)]);
  const res: any = await AI.generate({
    model: 'anthropic/claude-opus-5-5',
    system: `You are ${OWNER.name}'s editor. ${WHO}
${OWNER.first} wrote the post below himself. Your job is to make it land, not to replace it: keep every fact, every number, his opinion, his examples and his words wherever they are already good. Cut filler, sharpen the first line, keep one idea, fix the rhythm (short paragraphs, whitespace), and end on the line he would say out loud. Never add a fact, a quote, a number or a claim he did not make. If something is missing that the post needs, leave a [bracketed prompt] and say so in "check".
${RULES}
His learned voice profile (JSON, may be empty): ${profile ? JSON.stringify({ summary: profile.summary, rules: profile.rules, hooksThatWork: profile.hooksThatWork, hooksToAvoid: profile.hooksToAvoid, structure: profile.structure, vocabulary: profile.vocabulary }).slice(0, 8000) : 'none yet'}
His standing notes, which override everything else: ${JSON.stringify(notes.map((n) => n.note))}
Posts of his to match in rhythm and tone (JSON): ${JSON.stringify(examples).slice(0, 6000)}
${steer ? `His instruction for this edit: ${steer}` : ''}
Return the improved post (without hashtags), its first line as "hook", two alternative openings (different in kind: a claim, a scene or a number), "changes" as 3 to 8 short plain lines on what you changed and why, and "check" when he must confirm or fill something. No em dashes anywhere. Answer with JSON only.`,
    prompt: `${OWNER.first}'s draft:\n\n${text.slice(0, 6000)}`,
    temperature: 0.4,
    maxOutputTokens: 3000,
    structuredOutput: { schema },
  });
  const out = res?.output ?? {};
  const improved = String(out.improved ?? '').replace(/—/g, ',').trim() || text;
  return {
    original: text,
    improved,
    hook: String(out.hook ?? improved.split('\n')[0] ?? '').slice(0, 200),
    altHooks: (Array.isArray(out.altHooks) ? out.altHooks : []).map((h: unknown) => String(h)).slice(0, 2),
    changes: (Array.isArray(out.changes) ? out.changes : []).map((c: unknown) => String(c).replace(/—/g, ',')).slice(0, 8),
    check: out.check ? String(out.check) : undefined,
    lint: lintPost(improved),
  };
}
