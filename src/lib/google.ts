import { Integrations } from 'lua-cli';

// Read-only Google access for the LinkedIn agent's own tools. Every call here is a GET: nothing in this file can send, change
// or delete mail or calendar events. The agent's AI has no other Gmail or Calendar tools (the integration tool servers
// are switched off), so this is its only way in.

const GMAIL_TYPES = ['googlemail', 'gmail'];
const CAL_TYPES = ['googlecalendar', 'google_calendar', 'google'];

async function get(types: string[], path: string, query: Record<string, string | number | boolean> = {}) {
  let lastError = '';
  for (const type of types) {
    try {
      const res: any = await Integrations.passthrough(type, { method: 'GET', path, query });
      if (res.status >= 200 && res.status < 300) return res.data;
      lastError = `${type}: HTTP ${res.status}`;
    } catch (e: any) {
      lastError = `${type}: ${e?.code ?? e?.message ?? e}`;
    }
  }
  throw new Error(`Read failed (${lastError})`);
}

export const gmailGet = (path: string, query: Record<string, string | number | boolean> = {}) => get(GMAIL_TYPES, `gmail/v1/users/me/${path}`, query);
export const calendarGet = (path: string, query: Record<string, string | number | boolean> = {}) => get(CAL_TYPES, `calendar/v3/${path}`, query);

export const header = (m: any, name: string) =>
  String((m?.payload?.headers ?? []).find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '');

const b64decode = (data: string) => {
  const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

/** The readable text of a message: text/plain if there is one, else text/html with the tags stripped. */
export function bodyText(m: any): string {
  const parts: any[] = [];
  const walk = (p: any) => { if (!p) return; parts.push(p); (p.parts ?? []).forEach(walk); };
  walk(m?.payload);
  const plain = parts.find((p) => p.mimeType === 'text/plain' && p.body?.data);
  if (plain) return b64decode(plain.body.data);
  const html = parts.find((p) => p.mimeType === 'text/html' && p.body?.data);
  if (html) return b64decode(html.body.data).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return String(m?.snippet ?? '');
}

/** Drop quoted replies ("On … wrote:") so a thread reads as the new text of each message. */
export const withoutQuotes = (text: string) => text.split(/\n(?:On .{5,120} wrote:|-{2,} ?Original Message|From: .+\nSent: )/)[0].trim();
