import { Data, type LuaQuery } from 'lua-cli';
import { OWNER } from '../knowledge/owner';

// Every collection the agent keeps, with its shape. Collections are shared by sandbox and production.

export const SOURCES = 'sources'; // what the intake reads: feeds, a Gmail label, Slack channels
export const STORIES = 'stories'; // items the intake found, scored for relevance
export const SEEDS = 'seeds'; // the owner's own material: anecdotes, opinions, links he sent, answers to the daily question
export const POSTS = 'posts'; // every draft, what happened to it, the posted text and its numbers
export const VOICE = 'voice_profile'; // the learned voice profile, one entry per weekly review
export const NOTES = 'voice_notes'; // rules ${OWNER.first} states in chat ("never open with a question"), applied at once
export const PROMPTS = 'story_prompts'; // the daily questions already asked, so they don't repeat

export type SourceKind = 'rss' | 'gmail-label' | 'slack';
export interface Source {
  name: string;
  kind: SourceKind;
  url?: string; // rss
  label?: string; // gmail-label
  channelId?: string; // slack
  tags?: string[];
  active: boolean;
  addedAt: string;
  addedBy: 'default' | 'owner';
  lastFetchAt?: string;
  lastStatus?: string; // "ok", "HTTP 404", "timeout"...
  lastCount?: number; // items seen on the last fetch
}

export interface Story {
  url: string;
  title: string;
  source: string; // source name
  sourceKind: SourceKind | 'link'; // 'link': ${OWNER.first} sent it
  publishedAt?: string;
  fetchedAt: string;
  excerpt: string; // up to 1,500 chars
  text?: string; // readable full text when available (feeds with full content, pages ${OWNER.first} sent), up to 6,000 chars
  score?: number; // 0 to 100 relevance for ${OWNER.first}
  why?: string;
  angleHint?: string;
  status: 'new' | 'used' | 'skipped';
  usedPostId?: string;
  fromOwner?: boolean;
  ownerNote?: string; // why it caught his eye
}

export interface Seed {
  text: string;
  kind: 'anecdote' | 'opinion' | 'link' | 'answer';
  url?: string;
  title?: string;
  at: string;
  used?: boolean;
  usedPostId?: string;
}

export type PostStatus = 'draft' | 'posted' | 'rejected' | 'expired';
export interface Post {
  at: string; // ISO created
  date: string; // YYYY-MM-DD the draft was for
  rank?: number; // 1 or 2 within the day
  status: PostStatus;
  pillar: string;
  topic: string;
  angle: string; // the memorable take, one sentence
  hook: string;
  altHooks: string[];
  draft: string; // the agent's final draft (after the polish pass)
  hashtags: string[];
  visual?: string;
  check?: string;
  sources: string[];
  scores?: Record<string, number>;
  judgeNote?: string;
  lint?: string[];
  finalText?: string; // what ${OWNER.first} actually posted
  original?: string; // ${OWNER.first}'s own draft before the agent improved it (Write page, improve_post)
  editRatio?: number; // 0 = posted as drafted, 1 = rewrote everything
  postedAt?: string;
  postUrl?: string;
  rejectReason?: string;
  metrics?: { impressions?: number; reactions?: number; comments?: number; reposts?: number; recordedAt: string };
  favourite?: boolean;
  origin: 'agent' | 'import' | 'owner';
}

export interface VoiceRule { rule: string; evidence: string; confidence: 'early signal' | 'moderate' | 'strong' }
export interface VoiceProfile {
  kind: 'profile';
  at: string;
  sampleSize: number;
  summary: string; // 3 to 5 lines: who ${OWNER.first} sounds like on LinkedIn
  rules: VoiceRule[];
  hooksThatWork: string[];
  hooksToAvoid: string[];
  structure: string; // how his posts are built
  vocabulary: { use: string[]; avoid: string[] };
  exemplarIds: string[]; // post ids to show the writer as examples
  learnings: string[]; // what changed since the last review, newest first
}

export interface VoiceNote { note: string; at: string; active: boolean }

/** Every entry matching the filter, newest pages first is not guaranteed, so sort after. */
export async function allEntries<T = any>(collection: string, filter: LuaQuery = {}, max = 500): Promise<{ id: string; data: T }[]> {
  const out: { id: string; data: T }[] = [];
  for (let page = 1; out.length < max; page++) {
    const res: any = await Data.get(collection, filter, page, 100).catch(() => ({ data: [], pagination: {} }));
    for (const e of res.data ?? []) out.push({ id: e.id, data: e.data as T });
    if (!res.pagination?.hasNextPage) break;
  }
  return out.slice(0, max);
}

export const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const byNewest = <T extends { data: { at?: string; fetchedAt?: string } }>(a: T, b: T) =>
  String(b.data.at ?? b.data.fetchedAt ?? '').localeCompare(String(a.data.at ?? a.data.fetchedAt ?? ''));

export async function latestProfile(): Promise<(VoiceProfile & { id: string }) | null> {
  const all = await allEntries<VoiceProfile>(VOICE, { kind: 'profile' }, 50);
  const newest = all.filter((e) => !/^\s*\[QA\]/i.test(e.data.summary ?? '')).sort(byNewest)[0];
  return newest ? { ...newest.data, id: newest.id } : null;
}

export async function activeNotes(days = 120): Promise<VoiceNote[]> {
  const all = await allEntries<VoiceNote>(NOTES, { active: true, at: { $gte: isoDaysAgo(days) } }, 100);
  return all.sort(byNewest).map((e) => e.data);
}

export async function recentPosts(days: number, max = 200): Promise<{ id: string; data: Post }[]> {
  const all = await allEntries<Post>(POSTS, { at: { $gte: isoDaysAgo(days) } }, max);
  return all.sort(byNewest);
}

/** Posts the writer should imitate: favourites first, then the best-performing posted ones, then recent posted ones. */
export async function exemplars(max = 6, maxChars = 900): Promise<{ id: string; text: string; why: string }[]> {
  const posted = (await allEntries<Post>(POSTS, { status: 'posted' }, 400)).filter((e) => (e.data.finalText ?? e.data.draft ?? '').trim());
  const score = (p: Post) => (p.favourite ? 1_000_000 : 0) + (p.metrics?.reactions ?? 0) * 10 + (p.metrics?.comments ?? 0) * 30 + (p.metrics?.impressions ?? 0) / 100;
  const ranked = [...posted].sort((a, b) => score(b.data) - score(a.data) || String(b.data.postedAt ?? b.data.at).localeCompare(String(a.data.postedAt ?? a.data.at)));
  return ranked.slice(0, max).map((e) => ({
    id: e.id,
    text: (e.data.finalText ?? e.data.draft).slice(0, maxChars),
    why: e.data.favourite ? '${OWNER.first} marked it a favourite' : e.data.metrics ? `${e.data.metrics.reactions ?? 0} reactions, ${e.data.metrics.comments ?? 0} comments` : 'recent post',
  }));
}

export async function unusedSeeds(max = 12): Promise<{ id: string; data: Seed }[]> {
  const all = await allEntries<Seed>(SEEDS, { used: { $ne: true } }, 200);
  return all.sort(byNewest).slice(0, max);
}

export async function topStories(days = 4, minScore = 55, max = 14): Promise<{ id: string; data: Story }[]> {
  const all = await allEntries<Story>(STORIES, { status: 'new', fetchedAt: { $gte: isoDaysAgo(days) } }, 400);
  return all
    .filter((e) => (e.data.score ?? 0) >= minScore || e.data.fromOwner)
    .sort((a, b) => (b.data.fromOwner ? 1000 : 0) + (b.data.score ?? 0) - ((a.data.fromOwner ? 1000 : 0) + (a.data.score ?? 0)))
    .slice(0, max);
}

/** Word-level edit ratio between two texts: 0 when identical, 1 when nothing survived. */
export function editRatio(a: string, b: string) {
  const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').split(/\s+/).filter(Boolean);
  const x = words(a);
  const y = words(b);
  if (!x.length && !y.length) return 0;
  // Longest common subsequence over words, capped for very long texts.
  const n = Math.min(x.length, 600);
  const m = Math.min(y.length, 600);
  let prev = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    const cur = new Array(m + 1).fill(0);
    for (let j = 1; j <= m; j++) cur[j] = x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    prev = cur;
  }
  return Math.round((1 - prev[m] / Math.max(n, m)) * 100) / 100;
}

export const postSearchText = (p: Partial<Post>) => [p.date, p.pillar, p.topic, p.angle, p.hook, (p.finalText ?? p.draft ?? '').slice(0, 1500)].filter(Boolean).join(' | ');
