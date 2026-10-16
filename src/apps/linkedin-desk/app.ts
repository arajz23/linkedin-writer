import { Data, Workflows, defineWebApp, env, json, route } from 'lua-cli';
import { z } from 'zod';
import { todayLocal } from '../../lib/guards';
import { POSTS, SEEDS, SOURCES, allEntries, activeNotes, editRatio, latestProfile, postSearchText, recentPosts, topStories, unusedSeeds, type Post, type Source } from '../../lib/store';
import { AddSourceTool, ReadLinkTool } from '../../skills/tools/SourceTools';
import { AddVoiceNoteTool, SaveSeedTool } from '../../skills/tools/MaterialTools';
import { MarkPostedTool, RecordMetricsTool, RejectDraftTool, RunNowTool } from '../../skills/tools/PostTools';
import { improvePost } from '../../lib/improve';
import { PILLAR_NAMES } from '../../knowledge/voice';
import { OWNER } from '../../knowledge/owner';

/**
 * LinkedIn desk: one page. Today's two drafts with the three buttons that matter (posted, posted with edits, not
 * this one), a box to drop a link or a story, the voice rules, past posts with a place for the numbers, the
 * reading list, and the chat with the writer docked beside it. Only the owner can use it: everything here is his.
 *
 *   lua apps dev linkedin-desk
 *   lua test webapp --name linkedin-desk --route 'GET /summary'
 */

const DEFAULT_OWNER_EMAILS = OWNER.email;
const isOwner = (auth: { email?: string | null }) =>
  (env('OWNER_EMAILS') || DEFAULT_OWNER_EMAILS).toLowerCase().split(',').map((s) => s.trim()).filter(Boolean).includes(String(auth.email ?? '').toLowerCase());
const forbidden = () => json({ message: `This is ${OWNER.first}'s LinkedIn desk.` }, 403);

// Workflow ids from lua.skill.yaml (stable across versions), with plain-words schedules for the health panel.
const AUTOMATIONS = [
  { id: '55ee1c4d-5638-4e93-ada3-c63aee4b7063', name: 'daily-draft', label: 'Morning drafts', schedule: '06:30 Mon to Sat' },
  { id: '22b08bf1-2475-4831-bde9-d8f0820b3937', name: 'intake', label: 'Reading the sources', schedule: '05:15, 11:15, 15:15, 20:15' },
  { id: 'd7198ad7-7c0d-499e-a1d8-c57b4e5d1200', name: 'story-prompt', label: 'One question', schedule: '17:30 weekdays' },
  { id: '6bc281ef-d790-492c-9835-2beca65e0429', name: 'voice-review', label: 'Voice review', schedule: 'Sundays 16:00' },
];

async function health() {
  const runs: any[] = await Workflows.list({ limit: 100 } as any).catch(() => []);
  return AUTOMATIONS.map((a) => {
    const mine = runs.filter((r) => r.workflowId === a.id).sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
    const last = mine[0];
    const lastOk = mine.find((r) => r.status === 'completed');
    return {
      name: a.name, label: a.label, schedule: a.schedule,
      lastStatus: last?.status, lastAt: last?.createdAt, lastOkAt: lastOk?.createdAt,
      lastError: last && !['completed', 'running', 'queued', 'waiting', 'suspended'].includes(last.status) ? String(last.failureReason ?? last.reason ?? last.error?.code ?? '').slice(0, 160) || undefined : undefined,
    };
  });
}

const postRow = (p: { id: string; data: Post }) => ({
  id: p.id, date: p.data.date, rank: p.data.rank, status: p.data.status, pillar: p.data.pillar, topic: p.data.topic, angle: p.data.angle,
  hook: p.data.hook, altHooks: p.data.altHooks ?? [], draft: p.data.draft, hashtags: p.data.hashtags ?? [], visual: p.data.visual, check: p.data.check,
  sources: p.data.sources ?? [], judge: p.data.scores?.total, judgeNote: p.data.judgeNote, finalText: p.data.finalText, editRatio: p.data.editRatio,
  postedAt: p.data.postedAt, postUrl: p.data.postUrl, rejectReason: p.data.rejectReason, metrics: p.data.metrics, favourite: p.data.favourite, origin: p.data.origin,
});

export default defineWebApp({
  name: 'linkedin-desk',
  title: 'LinkedIn desk',
  description: "Today's drafts, your material, your voice, your numbers, and a chat with the writer",
  pages: {
    root: './web',
    nav: [
      { path: '/', label: 'Today' },
      { path: '/write', label: 'Write' },
      { path: '/tell', label: 'Tell me' },
      { path: '/voice', label: 'My voice' },
      { path: '/posts', label: 'Posts' },
      { path: '/reading', label: 'Reading' },
      { path: '/health', label: 'Running' },
    ],
  },
  routes: {
    'GET /summary': route({
      description: 'Everything the page shows, in one call',
      handler: async ({ auth }) => {
        if (!isOwner(auth)) return forbidden();
        const today = todayLocal();
        const [recent, stories, seeds, profile, notes, sources, automations] = await Promise.all([
          recentPosts(45, 300), topStories(4, 55, 10), unusedSeeds(10), latestProfile(), activeNotes(), allEntries<Source>(SOURCES, { active: true }, 200), health().catch(() => []),
        ]);
        const agentDrafts = recent.filter((p) => p.data.origin === 'agent');
        // Today's drafts, or the newest day that has any, so the page is never empty after a missed morning.
        const latestDate = agentDrafts.map((p) => p.data.date).sort().reverse()[0];
        const drafts = agentDrafts.filter((p) => p.data.date === latestDate).sort((a, b) => (a.data.rank ?? 0) - (b.data.rank ?? 0)).map(postRow);
        const history = recent.filter((p) => p.data.date !== latestDate || p.data.origin !== 'agent').filter((p) => p.data.status !== 'expired').map(postRow).sort((a, b) => b.date.localeCompare(a.date));
        return {
          generatedAt: new Date().toISOString(),
          owner: { first: OWNER.first, name: OWNER.name, timezone: OWNER.timezone, city: OWNER.city },
          pillars: PILLAR_NAMES,
          today,
          draftsDate: latestDate,
          drafts,
          history: history.slice(0, 40),
          material: {
            stories: stories.map((s) => ({ id: s.id, source: s.data.source, title: s.data.title, url: s.data.url, published: s.data.publishedAt?.slice(0, 10), score: s.data.score, angleHint: s.data.angleHint, fromOwner: s.data.fromOwner || undefined })),
            seeds: seeds.map((s) => ({ id: s.id, kind: s.data.kind, at: s.data.at.slice(0, 10), title: s.data.title, text: s.data.text })),
          },
          voice: {
            profile: profile ? { at: profile.at.slice(0, 10), sampleSize: profile.sampleSize, summary: profile.summary, rules: profile.rules, hooksThatWork: profile.hooksThatWork, hooksToAvoid: profile.hooksToAvoid, learnings: profile.learnings.slice(0, 6) } : null,
            notes: notes.map((n) => ({ at: n.at.slice(0, 10), note: n.note })),
          },
          sources: sources.map((e) => ({ id: e.id, name: e.data.name, kind: e.data.kind, where: e.data.url ?? e.data.label ?? e.data.channelId, lastRead: e.data.lastFetchAt, lastStatus: e.data.lastStatus, lastCount: e.data.lastCount })).sort((a, b) => a.name.localeCompare(b.name)),
          automations,
        };
      },
    }),

    'POST /drafts/:id': route({
      description: `What ${OWNER.first} did with a draft: posted (as is, with another opening, or with his own text) or rejected with a reason`,
      params: z.object({ id: z.string().min(1) }),
      body: z.object({
        action: z.enum(['posted', 'rejected']),
        finalText: z.string().optional(),
        altHook: z.enum(['B', 'C']).optional(),
        reason: z.string().optional(),
        postUrl: z.string().optional(),
      }),
      handler: async ({ params, body, auth }) => {
        if (!isOwner(auth)) return forbidden();
        if (body.action === 'posted') return new MarkPostedTool().execute({ id: params.id, finalText: body.finalText?.trim() || undefined, altHook: body.altHook, postUrl: body.postUrl?.trim() || undefined });
        return new RejectDraftTool().execute({ id: params.id, reason: body.reason?.trim() || 'not this one' });
      },
    }),

    'POST /posts/:id/metrics': route({
      description: "A post's LinkedIn numbers, or marking it a favourite",
      params: z.object({ id: z.string().min(1) }),
      body: z.object({ impressions: z.number().int().min(0).optional(), reactions: z.number().int().min(0).optional(), comments: z.number().int().min(0).optional(), reposts: z.number().int().min(0).optional(), favourite: z.boolean().optional() }),
      handler: async ({ params, body, auth }) => {
        if (!isOwner(auth)) return forbidden();
        return new RecordMetricsTool().execute({ id: params.id, ...body });
      },
    }),

    'POST /improve': route({
      description: `${OWNER.first}'s own draft, made to land in his voice: improved text, other openings, what changed`,
      body: z.object({ text: z.string().min(40), steer: z.string().optional() }),
      handler: async ({ body, auth }) => {
        if (!isOwner(auth)) return forbidden();
        return improvePost(body.text, body.steer?.trim() || undefined);
      },
    }),

    'POST /posts': route({
      description: `A post ${OWNER.first} wrote himself (optionally improved here), posted`,
      body: z.object({ text: z.string().min(40), original: z.string().optional(), date: z.string().optional(), favourite: z.boolean().default(false) }),
      handler: async ({ body, auth }) => {
        if (!isOwner(auth)) return forbidden();
        const hook = body.text.split('\n')[0].slice(0, 160);
        const post: Post = { at: new Date().toISOString(), date: body.date ?? todayLocal(), status: 'posted', pillar: 'unknown', topic: hook.slice(0, 80), angle: '', hook, altHooks: [], draft: body.text, finalText: body.text, hashtags: (body.text.match(/#\w+/g) ?? []).map((h) => h.slice(1)), sources: [], postedAt: new Date().toISOString(), favourite: body.favourite, origin: 'owner', editRatio: body.original ? editRatio(body.original, body.text) : 0, original: body.original };
        const e = await Data.create(POSTS, post, postSearchText(post));
        return { saved: true, id: e.id };
      },
    }),

    'POST /link': route({
      description: `A link ${OWNER.first} sends, read and filed as material with his note`,
      body: z.object({ url: z.string().url(), note: z.string().optional() }),
      handler: async ({ body, auth }) => {
        if (!isOwner(auth)) return forbidden();
        return new ReadLinkTool().execute({ url: body.url, note: body.note?.trim() || undefined, fileAsMaterial: true });
      },
    }),

    'POST /seed': route({
      description: `Something ${OWNER.first} tells the writer: an anecdote, an opinion, an answer to the daily question`,
      body: z.object({ text: z.string().min(10), kind: z.enum(['anecdote', 'opinion', 'answer', 'link']).default('anecdote') }),
      handler: async ({ body, auth }) => {
        if (!isOwner(auth)) return forbidden();
        return new SaveSeedTool().execute({ text: body.text, kind: body.kind });
      },
    }),

    'DELETE /seed/:id': route({
      description: 'Drop a seed',
      params: z.object({ id: z.string().min(1) }),
      handler: async ({ params, auth }) => {
        if (!isOwner(auth)) return forbidden();
        await Data.delete(SEEDS, params.id);
        return { removed: true };
      },
    }),

    'POST /note': route({
      description: `A standing rule about how ${OWNER.first} writes`,
      body: z.object({ note: z.string().min(5) }),
      handler: async ({ body, auth }) => {
        if (!isOwner(auth)) return forbidden();
        return new AddVoiceNoteTool().execute({ note: body.note });
      },
    }),

    'POST /sources': route({
      description: 'Add a feed, Substack or publication by URL',
      body: z.object({ url: z.string().min(4), name: z.string().optional() }),
      handler: async ({ body, auth }) => {
        if (!isOwner(auth)) return forbidden();
        return new AddSourceTool().execute({ kind: 'rss', url: body.url, name: body.name?.trim() || undefined, tags: [] });
      },
    }),

    'DELETE /sources/:id': route({
      description: 'Stop reading a source (switched off, not deleted)',
      params: z.object({ id: z.string().min(1) }),
      handler: async ({ params, auth }) => {
        if (!isOwner(auth)) return forbidden();
        await Data.update(SOURCES, params.id, { active: false });
        return { removed: true };
      },
    }),

    'POST /run': route({
      description: 'Start a run now: today\'s drafts (with an optional steer), the intake, or the voice review',
      body: z.object({ what: z.enum(['draft', 'intake', 'review']), note: z.string().optional() }),
      handler: async ({ body, auth }) => {
        if (!isOwner(auth)) return forbidden();
        const r = await new RunNowTool().execute({ what: body.what, note: body.note?.trim() || undefined });
        return json(r, 202);
      },
    }),
  },
});
