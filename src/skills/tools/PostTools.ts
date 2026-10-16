import { LuaTool, Data, Workflows } from 'lua-cli';
import { z } from 'zod';
import { parseInput, todayLocal } from '../../lib/guards';
import { POSTS, allEntries, editRatio, postSearchText, recentPosts, type Post } from '../../lib/store';
import { improvePost } from '../../lib/improve';
import { OWNER } from '../../knowledge/owner';

// Drafts and what happened to them. Every outcome the owner reports here (posted, with the text he actually used;
// rejected, with why; the numbers a few days later) is what the weekly voice review learns from.

const which = z.object({
  id: z.string().optional().describe('Post id, when known'),
  date: z.string().optional().describe('YYYY-MM-DD; defaults to today'),
  rank: z.number().int().min(1).max(2).optional().describe('1 or 2: "post 1" is rank 1 of that day'),
});

async function resolve(input: z.infer<typeof which>) {
  if (input.id) {
    const e: any = await Data.getEntry(POSTS, input.id).catch(() => null);
    return e ? { id: e.id as string, data: e.data as Post } : null;
  }
  const date = input.date ?? todayLocal();
  const all = await allEntries<Post>(POSTS, { date }, 20);
  const agent = all.filter((p) => p.data.origin === 'agent');
  if (input.rank) return agent.find((p) => p.data.rank === input.rank) ?? null;
  return agent.length === 1 ? agent[0] : null;
}

const summary = (p: { id: string; data: Post }) => ({ id: p.id, date: p.data.date, rank: p.data.rank, status: p.data.status, pillar: p.data.pillar, topic: p.data.topic, hook: p.data.hook, judge: p.data.scores?.total, editRatio: p.data.editRatio, metrics: p.data.metrics, rejectReason: p.data.rejectReason });

export class ListDraftsTool implements LuaTool {
  name = 'list_drafts';
  description = "Today's drafts (or a given day's, or recent posts by status) with their full text. Call before acting on \"post 1\", \"rewrite 2\" or \"what did you send me this morning\".";
  inputSchema = z.object({
    date: z.string().optional().describe('YYYY-MM-DD; defaults to today'),
    status: z.enum(['draft', 'posted', 'rejected', 'expired', 'any']).default('any'),
    days: z.number().int().min(1).max(90).optional().describe('Instead of one date: the last n days'),
    full: z.boolean().default(true).describe('Include the full text'),
  });
  async execute(raw: z.infer<typeof this.inputSchema>) {
    const input = parseInput(this.inputSchema, raw);
    const posts = input.days ? await recentPosts(input.days, 100) : await allEntries<Post>(POSTS, { date: input.date ?? todayLocal() }, 20);
    const filtered = posts.filter((p) => input.status === 'any' || p.data.status === input.status).sort((a, b) => a.data.date.localeCompare(b.data.date) || (a.data.rank ?? 0) - (b.data.rank ?? 0));
    return {
      count: filtered.length,
      posts: filtered.map((p) => ({ ...summary(p), ...(input.full ? { draft: p.data.draft, altHooks: p.data.altHooks, hashtags: p.data.hashtags, check: p.data.check, sources: p.data.sources, finalText: p.data.finalText } : {}) })),
    };
  }
}

export class MarkPostedTool implements LuaTool {
  name = 'mark_posted';
  description =
    `Record that ${OWNER.first} posted a draft. Pass finalText when he pasted or described what he actually posted (his edits are the most valuable signal there is), ` +
    'or altHook when he said "with opening B". Without either, the draft is recorded as posted unchanged.';
  inputSchema = which.extend({
    finalText: z.string().optional().describe('The text he actually posted, verbatim'),
    altHook: z.enum(['B', 'C']).optional().describe('He used one of the other openings'),
    postUrl: z.string().optional(),
  });
  async execute(raw: z.infer<typeof this.inputSchema>) {
    const input = parseInput(this.inputSchema, raw);
    const hit = await resolve(input);
    if (!hit) return { updated: false, error: 'Which post? Give the date and rank (e.g. today, 1) or the id from list_drafts.' };
    let finalText = input.finalText?.trim();
    if (!finalText && input.altHook) {
      const alt = hit.data.altHooks?.[input.altHook === 'B' ? 0 : 1];
      if (alt) finalText = [alt, ...hit.data.draft.split('\n').slice(1)].join('\n');
    }
    finalText = finalText || hit.data.draft;
    const patch: Partial<Post> = { status: 'posted', postedAt: new Date().toISOString(), finalText, editRatio: editRatio(hit.data.draft, finalText), postUrl: input.postUrl };
    await Data.update(POSTS, hit.id, patch, postSearchText({ ...hit.data, ...patch }));
    // The other draft of the day was not chosen; it expires so it never shows as pending.
    if (hit.data.rank) {
      const siblings = await allEntries<Post>(POSTS, { date: hit.data.date }, 10);
      for (const s of siblings) if (s.id !== hit.id && s.data.status === 'draft' && s.data.origin === 'agent') await Data.update(POSTS, s.id, { status: 'expired' }).catch(() => null);
    }
    return { updated: true, id: hit.id, topic: hit.data.topic, editRatio: patch.editRatio, note: patch.editRatio && patch.editRatio > 0.05 ? 'Edits recorded; the Sunday review learns from them. Ask him in one line what the edit fixed if it is not obvious, and save it with add_voice_note.' : 'Posted as drafted.' };
  }
}

export class RejectDraftTool implements LuaTool {
  name = 'reject_draft';
  description = `Record that ${OWNER.first} turned a draft down, with his reason in his words. The reason shapes tomorrow and the weekly review.`;
  inputSchema = which.extend({ reason: z.string().trim().min(3) });
  async execute(raw: z.infer<typeof this.inputSchema>) {
    const input = parseInput(this.inputSchema, raw);
    const hit = await resolve(input);
    if (!hit) return { updated: false, error: 'Which post? Give the date and rank or the id from list_drafts.' };
    await Data.update(POSTS, hit.id, { status: 'rejected', rejectReason: input.reason });
    return { updated: true, id: hit.id, topic: hit.data.topic };
  }
}

export class RecordMetricsTool implements LuaTool {
  name = 'record_metrics';
  description = `Record a post's LinkedIn numbers when ${OWNER.first} reports them (impressions, reactions, comments, reposts), or mark it a favourite. Find the post by date and rank, by id, or by a few words of its topic.`;
  inputSchema = which.extend({
    topic: z.string().optional().describe('A few words of the topic, when date and rank are unknown'),
    impressions: z.number().int().min(0).optional(),
    reactions: z.number().int().min(0).optional(),
    comments: z.number().int().min(0).optional(),
    reposts: z.number().int().min(0).optional(),
    favourite: z.boolean().optional().describe(`true when ${OWNER.first} says this is one of his best; the writer imitates favourites`),
  });
  async execute(raw: z.infer<typeof this.inputSchema>) {
    const input = parseInput(this.inputSchema, raw);
    let hit = await resolve(input);
    if (!hit && input.topic) {
      const posted = await recentPosts(120, 300);
      const words = input.topic.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
      hit = posted.find((p) => p.data.status === 'posted' && words.filter((w) => `${p.data.topic} ${p.data.hook}`.toLowerCase().includes(w)).length >= Math.min(2, words.length)) ?? null;
    }
    if (!hit) return { updated: false, error: 'No post matched. Try list_drafts with days: 30 and pass the id.' };
    const metrics = { ...(hit.data.metrics ?? {}), ...(input.impressions !== undefined ? { impressions: input.impressions } : {}), ...(input.reactions !== undefined ? { reactions: input.reactions } : {}), ...(input.comments !== undefined ? { comments: input.comments } : {}), ...(input.reposts !== undefined ? { reposts: input.reposts } : {}), recordedAt: new Date().toISOString() };
    await Data.update(POSTS, hit.id, { metrics, ...(input.favourite !== undefined ? { favourite: input.favourite } : {}) });
    return { updated: true, id: hit.id, topic: hit.data.topic, metrics, favourite: input.favourite ?? hit.data.favourite };
  }
}

export class SavePostTool implements LuaTool {
  name = 'save_post';
  description = `File a post ${OWNER.first} wrote himself (pasted in chat), so the voice review learns from it and it can be marked a favourite or get numbers later.`;
  inputSchema = z.object({ text: z.string().trim().min(40), original: z.string().optional().describe('His own draft before improve_post, when there was one'), date: z.string().optional().describe('YYYY-MM-DD it was posted; defaults to today'), postUrl: z.string().optional(), favourite: z.boolean().default(false) });
  async execute(raw: z.infer<typeof this.inputSchema>) {
    const input = parseInput(this.inputSchema, raw);
    const hook = input.text.split('\n')[0].slice(0, 160);
    const post: Post = { at: new Date().toISOString(), date: input.date ?? todayLocal(), status: 'posted', pillar: 'unknown', topic: hook.slice(0, 80), angle: '', hook, altHooks: [], draft: input.text, finalText: input.text, hashtags: (input.text.match(/#\w+/g) ?? []).map((h) => h.slice(1)), sources: [], postedAt: new Date().toISOString(), postUrl: input.postUrl, favourite: input.favourite, origin: 'owner', editRatio: 0, original: input.original };
    const e = await Data.create(POSTS, post, postSearchText(post));
    return { saved: true, id: e.id };
  }
}

export class RunNowTool implements LuaTool {
  name = 'run_now';
  description =
    'Start a background run now: "draft" writes today\'s two drafts (optionally with a steer or a forced pillar) and emails them in a few minutes; "intake" reads all sources now; ' +
    `"review" rebuilds the voice profile. Use when ${OWNER.first} says "write it now", "read the news now", or "what have you learned, update your profile".`;
  inputSchema = z.object({
    what: z.enum(['draft', 'intake', 'review']),
    note: z.string().optional().describe(`draft: a steer in ${OWNER.first}'s words, e.g. "write about yesterday's demo, angry about slow procurement"`),
    pillar: z.enum(['take', 'building', 'field', 'people']).optional(),
  });
  async execute(raw: z.infer<typeof this.inputSchema>) {
    const input = parseInput(this.inputSchema, raw);
    const name = input.what === 'draft' ? 'daily-draft' : input.what === 'intake' ? 'intake' : 'voice-review';
    const payload = input.what === 'draft' ? { note: input.note, pillar: input.pillar } : input.what === 'intake' ? { days: 3 } : { days: 120 };
    const run: any = await Workflows.start(name, payload, { idempotencyKey: `${name}-${new Date().toISOString().slice(0, 16)}` } as any);
    return { started: true, runId: run?.runId ?? run?.id, note: input.what === 'draft' ? `Two drafts will land in ${OWNER.first}'s email in 3 to 6 minutes.` : input.what === 'intake' ? 'Reading every source; new stories appear in list_material in a few minutes.' : 'The new profile and a report will be emailed in a few minutes.' };
  }
}

export class ImprovePostTool implements LuaTool {
  name = 'improve_post';
  description =
    `${OWNER.first} wrote a post himself and wants it better: tighter, sharper hook, in his voice, with every fact kept. Returns the improved post, two other openings, what changed and anything he must check. ` +
    'Use when he pastes a draft and says "make this better", "tighten this", "is this any good", or asks for his voice on his own text.';
  inputSchema = z.object({ text: z.string().trim().min(40).describe("His draft, verbatim"), steer: z.string().optional().describe('What he asked for, e.g. "shorter", "angrier", "keep the joke"') });
  async execute(raw: z.infer<typeof this.inputSchema>) {
    const input = parseInput(this.inputSchema, raw);
    const r = await improvePost(input.text, input.steer);
    return { improved: r.improved, hook: r.hook, altHooks: r.altHooks, changes: r.changes, check: r.check, lint: r.lint.length ? r.lint : undefined, note: 'Give him the full improved post, then the changes in 3 lines at most. When he posts it, save it with save_post, passing his original as original.' };
  }
}
