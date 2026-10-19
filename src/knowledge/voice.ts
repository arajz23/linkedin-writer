import { OWNER } from './owner';

// The writing rules, built around the owner (src/knowledge/owner.ts). The writing guide itself is the owner's own
// DNA (OWNER.dna); the hard checks below are the few things that must hold whatever the model's taste. The weekly
// voice review adds learned rules on top (voice_profile collection) and the owner's chat notes (voice_notes) apply
// at once. When this file and the learned profile disagree, the profile wins: it is newer and comes from real posts.

export const WHO = OWNER.who;
export const AUDIENCE = OWNER.audience;
export const PILLARS = OWNER.pillars;
export const PILLAR_NAMES: Record<string, string> = Object.fromEntries(OWNER.pillars.map((p) => [p.key, p.name]));

// Soft rotation: which pillar leads on which weekday (0 = Sunday). The judge may override when the material is better.
export const PILLAR_BY_WEEKDAY: Record<number, string> = { 1: 'take', 2: 'building', 3: 'take', 4: 'field', 5: 'building', 6: 'people' };

// The hard checks. Everything about tone, structure, openings and endings is in the owner's DNA below, which wins
// over any instinct a model has about what a LinkedIn post looks like.
export const HARD_RULES = `Hard rules, checked mechanically:
- No em dashes anywhere. Use commas, full stops, colons or brackets.
- No artificial contrast structures: "it isn't X, it's Y", "not just X, but Y", "not because X, because Y", "less X, more Y", "the real question isn't X, it's Y".
- No AI or corporate vocabulary: delve, leverage, robust, seamless, unlock, elevate, game-changer, landscape, tapestry, journey, in today's world, at the end of the day, harness, empower, revolutionise, transformative, navigate, paradigm, synergy, supercharge, double down, unpack, dive deep, let that sink in, here's the kicker, this changes everything.
- Never the LinkedIn staircase: one sentence per line with blank lines between them to manufacture pauses. Write in natural paragraphs of two to four sentences.
- One idea per post, given room: usually 150 to 350 words, the subject decides.
- Hashtags are optional. When used, at most three or four, lower key, at the very end: ${OWNER.hashtags.map((h) => `#${h}`).join(' ')} and one or two specific ones.
- Confidential stays out: no client pricing, contract terms, internal metrics, candidate or HR detail, nothing the company has not announced. A client is named only when the story is already public; otherwise anonymise and say so in the check.
- Never invent a personal fact, a quote, a number, a client conversation or an emotional reaction. If the post needs one ${OWNER.first} has not given, leave a [bracketed prompt] and list it in the check.
- ${OWNER.offLimits}`;

export const RULES = `${HARD_RULES}

Everything else about how ${OWNER.first} writes is in his own words below. Follow it over any instinct about what a LinkedIn post should look like. Before returning anything, ask: would ${OWNER.first} actually say this to a friend over a beer?

${OWNER.dna}`;

export const AI_WORDS = ['delve', 'leverage', 'robust', 'seamless', 'unlock', 'elevate', 'game-changer', 'game changer', 'landscape', 'tapestry', 'journey', "in today's world", 'at the end of the day', 'harness', 'empower', 'revolutioni', 'transformative', 'navigate', 'paradigm', 'synergy', 'supercharge', 'double down', 'unpack', 'dive deep', 'let that sink in', "here's the kicker", 'this changes everything', 'thoughts?', 'agree?'];

/** Mechanical checks a draft must pass before it reaches the owner. Returns the problems found, empty when clean. */
export function lintPost(text: string): string[] {
  const issues: string[] = [];
  const body = text.replace(/(^|\n)\s*(#\w+\s*)+$/g, '').trim();
  const words = body.split(/\s+/).filter(Boolean).length;
  const opening = (body.match(/^[\s\S]*?[.!?](?=\s|$)/)?.[0] ?? body.split('\n')[0] ?? '').trim();
  if (/[—–]/.test(text)) issues.push('em or en dash');
  if (words < 100) issues.push(`too short (${words} words)`);
  if (words > 420) issues.push(`too long (${words} words)`);
  if (opening.split(/\s+/).length > 20) issues.push('opening over 20 words');
  if (/\b(it'?s|this is|that'?s|it was|this isn'?t|it isn'?t) not (just |only |about )?[^.]{2,60}?,? (it'?s|but|this is)\b/i.test(body) || /\bnot (just|only) [^.]{2,60}?, but\b/i.test(body) || /\bnot because [^.]{2,60}?\. because\b/i.test(body) || /\bless [^.]{2,40}?\. more\b/i.test(body)) issues.push('artificial contrast structure');
  for (const w of AI_WORDS) if (body.toLowerCase().includes(w)) issues.push(`AI word: ${w}`);
  // The staircase: most paragraphs are a single short sentence. Natural paragraphs run two to four sentences.
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length >= 4) {
    const single = paragraphs.filter((p) => !/\n/.test(p) && (p.match(/[.!?](\s|$)/g) ?? []).length <= 1 && p.split(/\s+/).length <= 14).length;
    if (single / paragraphs.length > 0.6) issues.push(`staircase format (${single} of ${paragraphs.length} paragraphs are one short sentence)`);
  }
  const emoji = (body.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  if (emoji > 1) issues.push(`${emoji} emoji`);
  const tags = (text.match(/#\w+/g) ?? []).length;
  if (tags > 4) issues.push(`${tags} hashtags`);
  if (/^\s*\d+[.)]\s/m.test(body)) issues.push('numbered list');
  if (/here'?s what i learned|let me explain|a thread/i.test(body)) issues.push('scaffolding phrase');
  return issues;
}
