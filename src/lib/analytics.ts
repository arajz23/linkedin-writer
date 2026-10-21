import { Data } from 'lua-cli';
import { POSTS, allEntries, isoDaysAgo, postSearchText, type Post } from './store';

// LinkedIn's analytics export, matched to the posts the agent knows. The page parses the spreadsheet (xlsx or csv)
// and sends plain rows; this matches each row to a post by URL, then by date, fills in the numbers, and creates a
// stub for a post the agent has never seen (its text can be added later from a screenshot).

export interface MetricRow {
  url?: string;
  date?: string; // YYYY-MM-DD
  impressions?: number;
  reactions?: number;
  comments?: number;
  reposts?: number;
  engagements?: number;
  text?: string;
}

export const normaliseUrl = (u?: string) => {
  if (!u) return '';
  try {
    const x = new URL(u.trim());
    x.search = ''; x.hash = '';
    return x.toString().replace(/\/$/, '').toLowerCase();
  } catch { return u.trim().toLowerCase(); }
};

const dayDiff = (a: string, b: string) => Math.abs((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);

export async function importMetricRows(rows: MetricRow[]) {
  const posts = await allEntries<Post>(POSTS, { status: 'posted' }, 600);
  const byUrl = new Map(posts.filter((p) => p.data.postUrl).map((p) => [normaliseUrl(p.data.postUrl), p]));
  const recordedAt = new Date().toISOString();
  let matched = 0, created = 0, skipped = 0;
  const unmatched: MetricRow[] = [];
  const used = new Set<string>();

  for (const r of rows) {
    const url = normaliseUrl(r.url);
    let hit = url ? byUrl.get(url) : undefined;
    if (!hit && r.date) {
      // The same day, posted, not already matched, preferring a post with no URL on record yet.
      const candidates = posts.filter((p) => !used.has(p.id) && p.data.date && dayDiff(p.data.date, r.date!) <= 1).sort((a, b) => Number(!!a.data.postUrl) - Number(!!b.data.postUrl));
      hit = candidates[0];
    }
    const metrics = { ...(r.impressions !== undefined ? { impressions: r.impressions } : {}), ...(r.reactions !== undefined ? { reactions: r.reactions } : {}), ...(r.comments !== undefined ? { comments: r.comments } : {}), ...(r.reposts !== undefined ? { reposts: r.reposts } : {}), ...(r.engagements !== undefined ? { engagements: r.engagements } : {}), recordedAt };
    if (Object.keys(metrics).length === 1) { skipped++; continue; }
    if (hit) {
      used.add(hit.id);
      await Data.update(POSTS, hit.id, { metrics: { ...(hit.data.metrics ?? {}), ...metrics }, ...(r.url && !hit.data.postUrl ? { postUrl: r.url } : {}) });
      matched++;
    } else if (r.url || r.text) {
      const date = r.date ?? recordedAt.slice(0, 10);
      const text = r.text?.trim() || '(text not captured yet: add it from a screenshot on the Posts page)';
      const post: Post = { at: recordedAt, date, status: 'posted', pillar: 'unknown', topic: r.text ? text.split('\n')[0].slice(0, 80) : `LinkedIn post of ${date}`, angle: '', hook: text.split('\n')[0].slice(0, 160), altHooks: [], draft: text, finalText: text, hashtags: [], sources: [], postedAt: `${date}T09:00:00.000Z`, postUrl: r.url, metrics, origin: 'import', editRatio: 0 };
      await Data.create(POSTS, post, postSearchText(post));
      created++;
    } else {
      unmatched.push(r);
    }
  }
  return { matched, created, skipped, unmatched: unmatched.length };
}

/** Posts with numbers from the last n days, shaped for the performance review. */
export async function performanceRows(days = 90) {
  const posts = (await allEntries<Post>(POSTS, { status: 'posted', postedAt: { $gte: isoDaysAgo(days) } }, 400)).filter((p) => p.data.metrics && (p.data.metrics.impressions || p.data.metrics.reactions || p.data.metrics.comments));
  return posts.map((p) => {
    const text = p.data.finalText ?? p.data.draft;
    const paragraphs = text.split(/\n\s*\n/).filter((x) => x.trim());
    const opening = (text.match(/^[\s\S]*?[.!?](?=\s|$)/)?.[0] ?? text.split('\n')[0]).trim();
    return {
      id: p.id, date: p.data.date, weekday: new Date(`${p.data.date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
      pillar: p.data.pillar, origin: p.data.origin, topic: p.data.topic, opening, openingWords: opening.split(/\s+/).length,
      words: text.split(/\s+/).filter(Boolean).length, paragraphs: paragraphs.length, hasQuestionOpening: /\?\s*$/.test(opening), hasBracket: /\[[^\]]+\]/.test(text),
      hashtags: (text.match(/#\w+/g) ?? []).length, editRatio: p.data.editRatio, favourite: p.data.favourite, metrics: p.data.metrics, excerpt: text.slice(0, 400),
    };
  }).sort((a, b) => (b.metrics?.impressions ?? 0) - (a.metrics?.impressions ?? 0));
}
