// Reading the outside world in code: RSS and Atom feeds (Substack, blogs, news) and single web pages.
// Everything here only fetches. Text that comes back is data for the model, never instructions.

export interface FeedItem { url: string; title: string; date?: string; summary: string; text?: string }

const UA = 'Mozilla/5.0 (compatible; LinkedInWriter/1.0)';

export const strip = (s: string) =>
  s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/h[1-6]>|<\/li>|<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#8217;|&rsquo;|&#39;|&apos;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;|&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&#8211;|&ndash;/g, '-')
    .replace(/&#8212;|&mdash;/g, ' - ')
    .replace(/&#\d+;|&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const tag = (block: string, name: string) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m?.[1] ?? '';
};

/** Links carry tracking junk that makes the same article look like two; drop it. */
export function cleanUrl(raw: string) {
  try {
    const u = new URL(raw.trim());
    for (const k of Array.from(u.searchParams.keys())) if (/^(utm_|ref$|source$|fbclid|gclid|mc_|_hs|igsh|s$|r$)/i.test(k)) u.searchParams.delete(k);
    u.hash = '';
    let s = u.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

export async function fetchText(url: string, timeoutMs = 12_000) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml,application/rss+xml,application/atom+xml,*/*' }, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** RSS 2.0 and Atom. Substack and most blogs ship full post text in content:encoded; keep it when present. */
export async function fetchFeed(url: string, maxItems = 25): Promise<FeedItem[]> {
  const xml = await fetchText(url);
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(xml)) throw new Error('not a feed');
  const items: FeedItem[] = [];
  for (const block of xml.split(/<item[\s>]|<entry[\s>]/).slice(1, maxItems + 1)) {
    const rawDate = strip(tag(block, 'pubDate') || tag(block, 'updated') || tag(block, 'published') || tag(block, 'dc:date'));
    const date = Date.parse(rawDate);
    const link = strip(tag(block, 'link')) || block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/)?.[1] || block.match(/<link[^>]*href="([^"]+)"/)?.[1] || '';
    const full = tag(block, 'content:encoded') || tag(block, 'content');
    const summary = strip(tag(block, 'description') || tag(block, 'summary')).slice(0, 1500);
    const text = full ? strip(full).slice(0, 6000) : undefined;
    if (!link) continue;
    items.push({
      url: cleanUrl(link),
      title: strip(tag(block, 'title')).slice(0, 200),
      date: Number.isNaN(date) ? undefined : new Date(date).toISOString(),
      summary: summary || (text ?? '').slice(0, 600),
      text: text && text.length > summary.length + 200 ? text : undefined,
    });
  }
  return items;
}

export interface Page { url: string; title: string; site: string; description: string; text: string }

/** A web page as readable text: the article or main element when there is one, otherwise the body. */
export async function readPage(url: string, maxChars = 8000): Promise<Page> {
  const clean = cleanUrl(url);
  const html = await fetchText(clean, 15_000);
  const title = strip(html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i)?.[1] ?? tag(html, 'title')).slice(0, 200);
  const description = strip(html.match(/<meta[^>]+(?:name="description"|property="og:description")[^>]+content="([^"]*)"/i)?.[1] ?? '').slice(0, 500);
  const site = strip(html.match(/<meta[^>]+property="og:site_name"[^>]+content="([^"]*)"/i)?.[1] ?? new URL(clean).hostname);
  const main = tag(html, 'article') || tag(html, 'main') || html.match(/<div[^>]+class="[^"]*(?:post-content|article-body|entry-content|body markup)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] || tag(html, 'body') || html;
  const text = strip(main.replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, ' ')).slice(0, maxChars);
  return { url: clean, title, site, description, text };
}

/** Substack and most publications: the feed is at /feed. Guess it from a page or publication URL. */
export function guessFeedUrl(input: string) {
  const s = input.trim();
  if (/\/(feed|rss|atom)(\.xml)?\/?$|\.xml$/i.test(s)) return s;
  try {
    const u = new URL(/^https?:/i.test(s) ? s : `https://${s}`);
    return `${u.origin}/feed`;
  } catch {
    return s;
  }
}
