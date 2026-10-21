import { AI } from 'lua-cli';

// A screenshot of a LinkedIn post, read by a vision model: the post's text, the author, the date when visible,
// and the numbers on screen (reactions, comments, reposts, impressions). Nothing is saved here; the page shows what
// was read and the owner confirms.

export interface ReadPost {
  text: string;
  author?: string;
  date?: string;
  impressions?: number;
  reactions?: number;
  comments?: number;
  reposts?: number;
  confidence: 'high' | 'medium' | 'low';
  note?: string;
}

const SYSTEM = `You read screenshots of LinkedIn posts. Return the post's full text exactly as written, with the original paragraph breaks (a blank line between paragraphs), without the "...more" link, without the author header, without reaction counts inside the text. Hashtags at the end stay. If the text is cut off by "...see more", return what is visible and say so in note. Read the numbers shown on screen when present: impressions (sometimes "views"), reactions (likes and other reactions, the number next to the reaction icons), comments, reposts. Leave a number out when it is not visible; never guess. Date: the post's publish date when visible, as YYYY-MM-DD, or the relative time text as shown ("3d", "1w"). confidence is how sure you are the text is complete and the numbers are right.
Answer with one JSON object only, no prose, no code fence: {"text": string, "author"?: string, "date"?: string, "impressions"?: integer, "reactions"?: integer, "comments"?: integer, "reposts"?: integer, "confidence": "high"|"medium"|"low", "note"?: string}`;

export async function readPostScreenshot(dataUrl: string, hint?: string): Promise<ReadPost> {
  const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!m) throw new Error('Expected a base64 image data URL');
  // The two-argument form takes multimodal content. The image goes as a data URL string: a Buffer would be
  // serialised to JSON on the way to the platform and rejected.
  const raw = await AI.generate(SYSTEM, [
    { type: 'text', text: hint ? `Read this post. Context: ${hint}` : 'Read this post.' },
    { type: 'image', image: dataUrl, mediaType: m[1] } as any,
  ]);
  const text = String(raw ?? '').trim();
  const json = text.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
  let out: any = {};
  try { out = JSON.parse(json); } catch { out = { text, confidence: 'low', note: 'The reader answered in prose; check the text.' }; }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : typeof v === 'string' && /^\d[\d,]*$/.test(v) ? Number(v.replace(/,/g, '')) : undefined);
  return {
    text: String(out.text ?? '').trim(),
    author: out.author ? String(out.author) : undefined,
    date: out.date ? String(out.date) : undefined,
    impressions: num(out.impressions), reactions: num(out.reactions), comments: num(out.comments), reposts: num(out.reposts),
    confidence: (['high', 'medium', 'low'] as const).includes(out.confidence) ? out.confidence : 'low',
    note: out.note ? String(out.note) : undefined,
  };
}

/** "3d", "1w", "2mo" or a date, into YYYY-MM-DD relative to now. */
export function resolveRelativeDate(s?: string): string | undefined {
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.trim().match(/^(\d+)\s*(h|d|w|mo|m|y)\b/i);
  if (!m) { const t = Date.parse(s); return Number.isNaN(t) ? undefined : new Date(t).toISOString().slice(0, 10); }
  const n = Number(m[1]); const unit = m[2].toLowerCase();
  const days = unit === 'h' ? 0 : unit === 'd' ? n : unit === 'w' ? n * 7 : unit === 'y' ? n * 365 : n * 30;
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}
