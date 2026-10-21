import { LuaTool, Data } from 'lua-cli';
import { z } from 'zod';
import { parseInput } from '../../lib/guards';
import { NOTES, PROPOSALS, SEEDS, activeNotes, latestProfile, openProposals, topStories, unusedSeeds, exemplars } from '../../lib/store';
import { RULES } from '../../knowledge/voice';
import { OWNER } from '../../knowledge/owner';

// the owner's own material and his voice, in chat: seeds (anecdotes, opinions, answers to the daily question), standing
// rules he states, and the learned profile.

export class SaveSeedTool implements LuaTool {
  name = 'save_seed';
  description =
    `File something ${OWNER.first} said as material for a future post: an anecdote from a client call, an opinion, an answer to the daily question, a pasted text. ` +
    `Keep his words; do not polish them. Call this whenever ${OWNER.first} tells you something about his week that could become a post, even in passing.`;
  inputSchema = z.object({
    text: z.string().trim().min(10).describe(`${OWNER.first}'s words, as close to verbatim as possible`),
    kind: z.enum(['anecdote', 'opinion', 'answer', 'link']).default('anecdote'),
    title: z.string().trim().optional().describe('A few words to find it by'),
  });
  async execute(raw: z.infer<typeof this.inputSchema>) {
    const input = parseInput(this.inputSchema, raw);
    const at = new Date().toISOString();
    const entry = await Data.create(SEEDS, { text: input.text, kind: input.kind, title: input.title, at, used: false }, `${input.title ?? ''} ${input.text.slice(0, 1200)}`);
    return { saved: true, id: entry.id, note: 'It will be in the material for the next draft. Say "write it now" to draft from it today.' };
  }
}

export class ListMaterialTool implements LuaTool {
  name = 'list_material';
  description = `What the next draft will be built from: the best scored stories from the intake and ${OWNER.first}'s unused seeds. Use when ${OWNER.first} asks what you have, what's in the pipeline, or what you'd write about.`;
  inputSchema = z.object({ days: z.number().int().min(1).max(14).default(4), minScore: z.number().int().min(0).max(100).default(55) });
  async execute(raw: z.infer<typeof this.inputSchema>) {
    const input = parseInput(this.inputSchema, raw);
    const [stories, seeds] = await Promise.all([topStories(input.days, input.minScore, 20), unusedSeeds(20)]);
    return {
      stories: stories.map((s) => ({ id: s.id, source: s.data.source, title: s.data.title, url: s.data.url, published: s.data.publishedAt?.slice(0, 10), score: s.data.score, angleHint: s.data.angleHint, fromOwner: s.data.fromOwner || undefined })),
      seeds: seeds.map((s) => ({ id: s.id, kind: s.data.kind, at: s.data.at.slice(0, 10), title: s.data.title, text: s.data.text.slice(0, 400) })),
    };
  }
}

export class AddVoiceNoteTool implements LuaTool {
  name = 'add_voice_note';
  description =
    `Record a rule ${OWNER.first} states about how he writes or what he wants ("never open with a question", "more numbers", "stop mentioning ${OWNER.city} in every post"). ` +
    `It applies to every draft from now on and feeds the weekly voice review. Call it whenever ${OWNER.first} gives feedback that goes beyond one post.`;
  inputSchema = z.object({ note: z.string().trim().min(5).describe(`The rule in ${OWNER.first}'s words`) });
  async execute(raw: z.infer<typeof this.inputSchema>) {
    const input = parseInput(this.inputSchema, raw);
    const entry = await Data.create(NOTES, { note: input.note, at: new Date().toISOString(), active: true }, input.note);
    return { saved: true, id: entry.id };
  }
}

export class GetVoiceProfileTool implements LuaTool {
  name = 'get_voice_profile';
  description = `${OWNER.first}'s learned voice profile (from the weekly review of his posts, edits and rejections), his standing notes and the posts to imitate. Call before writing or rewriting any post in chat, and when ${OWNER.first} asks what you've learned about his voice.`;
  inputSchema = z.object({});
  async execute() {
    const [profile, notes, examples, proposals] = await Promise.all([latestProfile(), activeNotes(), exemplars(4, 900), openProposals()]);
    return {
      standingRules: RULES,
      proposalsWaiting: proposals.map((p, i) => ({ n: i + 1, id: p.id, rule: p.data.rule, why: p.data.why })),
      notes: notes.map((n) => ({ at: n.at.slice(0, 10), note: n.note })),
      profile: profile ? { reviewedAt: profile.at.slice(0, 10), sampleSize: profile.sampleSize, summary: profile.summary, rules: profile.rules, hooksThatWork: profile.hooksThatWork, hooksToAvoid: profile.hooksToAvoid, structure: profile.structure, vocabulary: profile.vocabulary, learnings: profile.learnings.slice(0, 8) } : null,
      note: profile ? undefined : 'No voice review yet. Import past posts (scripts/import_linkedin_posts.py) or wait for the first Sunday review; until then the standing rules and notes apply.',
      exemplars: examples,
    };
  }
}

export class DecideProposalTool implements LuaTool {
  name = 'decide_proposal';
  description =
    'Accept or decline a rule the monthly performance review proposed ("accept 1 and 3, decline 2"). Numbers refer to the order in get_voice_profile\'s proposalsWaiting. An accepted rule becomes a standing note the writer follows from the next draft.';
  inputSchema = z.object({
    n: z.number().int().min(1).optional().describe('The proposal number from proposalsWaiting'),
    id: z.string().optional().describe('Or its id'),
    decision: z.enum(['accepted', 'declined']),
    note: z.string().optional().describe(`${OWNER.first}'s reason or tweak, in his words`),
  });
  async execute(raw: z.infer<typeof this.inputSchema>) {
    const input = parseInput(this.inputSchema, raw);
    const open = await openProposals();
    const hit = input.id ? open.find((p) => p.id === input.id) : input.n ? open[input.n - 1] : undefined;
    if (!hit) return { updated: false, error: 'No such open proposal. Call get_voice_profile for the list.' };
    const decidedAt = new Date().toISOString();
    await Data.update(PROPOSALS, hit.id, { status: input.decision, decidedAt, decisionNote: input.note });
    if (input.decision === 'accepted') await Data.create(NOTES, { note: input.note?.trim() ? `${hit.data.rule} (${input.note.trim()})` : hit.data.rule, at: decidedAt, active: true, fromProposal: hit.id }, hit.data.rule);
    return { updated: true, rule: hit.data.rule, decision: input.decision };
  }
}
