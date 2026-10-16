import { Integrations } from 'lua-cli';

// Recent Slack messages read in code, so workflow agent steps get them as input instead of spending their time
// budget on tool calls. Tries the owner's own Slack connection first (sees private channels he is in), then the bot.

const TYPES = ['slack', 'slackbot'];
// Joins, leaves, topic changes and the like carry no content; bot posts and file shares (often the news links) do.
const SKIP_SUBTYPES = /^(channel_|group_)|_join$|_leave$|^pinned_item$|^unpinned_item$/;

export interface SlackMessage { channel: string; date: string; user: string; userId?: string; text: string; replies?: number }

// People's display names, so messages read "Jane: …" rather than "U0123ABCDEF: …". Looked up once per call.
async function names(ids: string[]) {
  const out = new Map<string, string>();
  for (const id of ids.filter((i) => !out.has(i)).slice(0, 40)) {
    for (const type of TYPES) {
      try {
        const res: any = await Integrations.passthrough(type, { method: 'GET', path: 'users.info', query: { user: id } });
        const u = res.data?.user;
        if (res.data?.ok && u) { out.set(id, u.profile?.real_name || u.real_name || u.name || id); break; }
      } catch {
        // try the next connection
      }
    }
  }
  return out;
}

export async function slackHistory(
  channels: { id: string; name: string }[],
  sinceMs: number,
  perChannel = 40,
  log: (s: string) => void = () => {},
  opts: { maxChars?: number; botName?: string } = {},
) {
  const out: SlackMessage[] = [];
  for (const ch of channels) {
    let done = false;
    for (const type of TYPES) {
      if (done) break;
      try {
        const res: any = await Integrations.passthrough(type, {
          method: 'GET',
          path: 'conversations.history',
          query: { channel: ch.id, oldest: String(Math.floor(sinceMs / 1000)), limit: perChannel },
        });
        if (res.status < 200 || res.status >= 300 || !res.data?.ok) { log(`${ch.name} via ${type}: ${res.data?.error ?? res.status}`); continue; }
        for (const m of res.data.messages ?? []) {
          if (m.subtype && SKIP_SUBTYPES.test(m.subtype)) continue;
          const attached = (m.attachments ?? []).map((a: any) => [a.title, a.text ?? a.fallback].filter(Boolean).join(': ')).join(' | ');
          const text = [m.text, attached].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
          if (!text) continue;
          out.push({
            channel: ch.name,
            date: new Date(Number(m.ts) * 1000).toISOString().slice(0, 10),
            user: m.user_profile?.real_name ?? m.bot_profile?.name ?? m.username ?? m.user ?? opts.botName ?? (m.bot_id ? 'bot' : 'unknown'),
            userId: m.user,
            text: text.slice(0, opts.maxChars ?? 500),
            replies: m.reply_count || undefined,
          });
        }
        done = true;
      } catch (e: any) {
        log(`${ch.name} via ${type}: ${e?.message ?? e}`);
      }
    }
  }
  // Swap user ids for names, in the sender and in <@U…> mentions.
  const ids = new Set<string>();
  for (const m of out) {
    if (/^U[A-Z0-9]{6,}$/.test(m.user)) ids.add(m.user);
    for (const x of m.text.matchAll(/<@(U[A-Z0-9]{6,})>/g)) ids.add(x[1]);
  }
  if (ids.size) {
    const map = await names(Array.from(ids));
    for (const m of out) {
      m.user = map.get(m.user) ?? m.user;
      m.text = m.text.replace(/<@(U[A-Z0-9]{6,})>/g, (_x, id) => `@${map.get(id) ?? id}`);
    }
  }
  return out;
}

// JSON of as many whole items as fit in maxChars, so a prompt never gets a message cut in half.
export function capJson(items: unknown[], maxChars: number) {
  const kept: unknown[] = [];
  let size = 2;
  for (const item of items) {
    const n = JSON.stringify(item).length + 1;
    if (size + n > maxChars) break;
    kept.push(item);
    size += n;
  }
  return JSON.stringify(kept);
}
