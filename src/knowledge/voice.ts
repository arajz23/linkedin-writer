import { OWNER } from './owner';

// The writing rules, built around the owner (src/knowledge/owner.ts). The weekly voice review adds learned rules
// on top (voice_profile collection) and the owner's chat notes (voice_notes) apply at once. When this file and the
// learned profile disagree, the profile wins: it is newer and comes from real posts.

export const WHO = OWNER.who;
export const AUDIENCE = OWNER.audience;
export const PILLARS = OWNER.pillars;
export const PILLAR_NAMES: Record<string, string> = Object.fromEntries(OWNER.pillars.map((p) => [p.key, p.name]));

// Soft rotation: which pillar leads on which weekday (0 = Sunday). The judge may override when the material is better.
export const PILLAR_BY_WEEKDAY: Record<number, string> = { 1: 'take', 2: 'building', 3: 'take', 4: 'field', 5: 'building', 6: 'people' };

export const RULES = `Rules for every post (non-negotiable):
- Hook first: the first line is the whole post's reason to exist. Under 15 words, specific, no question marks unless the question is genuinely surprising.
- 100 to 220 words. Short paragraphs of one to three lines. Whitespace is part of the rhythm.
- One idea per post. One real opinion. At least one concrete detail: a number, a name of a place, a thing that actually happened.
- Plain words. Say it the way ${OWNER.first} would say it to a founder over coffee.
- End with one line that lands: a consequence, a question ${OWNER.first} actually wants answered, or the line he would say out loud. No "Thoughts?" and no "Agree?".
- No em dashes anywhere. Use commas, full stops, colons or brackets.
- No "it isn't X, it's Y", no "not just X, but Y", no "X? No. Y." reversal tricks.
- No AI vocabulary: delve, leverage, robust, seamless, unlock, elevate, game-changer, landscape, tapestry, journey, in today's world, at the end of the day, harness, empower, revolutionise, transformative, navigate, paradigm, synergy, supercharge, double down, unpack, dive deep, let that sink in.
- No numbered listicles, no bullet walls, no "Here's what I learned:" scaffolding, no "Let me explain".
- At most one emoji, and usually none. 3 to 5 hashtags at the end, lower key: ${OWNER.hashtags.map((h) => `#${h}`).join(' ')} and one or two specific ones.
- Confidential stays out: no client pricing, contract terms, internal metrics, candidate or HR detail, nothing the company has not announced. A client is named only when the story is already public; otherwise anonymise and say so in the check.
- Never invent a personal fact, a quote or a number. If the post needs one ${OWNER.first} has not given, leave a [bracketed prompt] and list it in the check.
- ${OWNER.offLimits}`;

export const AI_WORDS = ['delve', 'leverage', 'robust', 'seamless', 'unlock', 'elevate', 'game-changer', 'game changer', 'landscape', 'tapestry', 'journey', "in today's world", 'at the end of the day', 'harness', 'empower', 'revolutioni', 'transformative', 'navigate', 'paradigm', 'synergy', 'supercharge', 'double down', 'unpack', 'dive deep', 'let that sink in', 'thoughts?', 'agree?'];

/** Mechanical checks a draft must pass before it reaches the owner. Returns the problems found, empty when clean. */
export function lintPost(text: string): string[] {
  const issues: string[] = [];
  const body = text.replace(/(^|\n)\s*(#\w+\s*)+$/g, '').trim();
  const words = body.split(/\s+/).filter(Boolean).length;
  const hook = body.split('\n')[0] ?? '';
  if (/[—–]/.test(text)) issues.push('em or en dash');
  if (words < 80) issues.push(`too short (${words} words)`);
  if (words > 240) issues.push(`too long (${words} words)`);
  if (hook.split(/\s+/).length > 16) issues.push('hook over 15 words');
  if (/\b(it'?s|this is|that'?s|it was|this isn'?t|it isn'?t) not (just |only |about )?[^.]{2,60}?,? (it'?s|but|this is)\b/i.test(body) || /\bnot (just|only) [^.]{2,60}?, but\b/i.test(body)) issues.push('"not X, but Y" construction');
  for (const w of AI_WORDS) if (body.toLowerCase().includes(w)) issues.push(`AI word: ${w}`);
  const emoji = (body.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  if (emoji > 1) issues.push(`${emoji} emoji`);
  const tags = (text.match(/#\w+/g) ?? []).length;
  if (tags > 6) issues.push(`${tags} hashtags`);
  if (/^\s*\d+[.)]\s/m.test(body)) issues.push('numbered list');
  if (/here'?s what i learned|let me explain|a thread/i.test(body)) issues.push('scaffolding phrase');
  return issues;
}
