import { useState, type ReactNode } from 'react';
import { Button } from '@lua-ai-global/ui/button';
import { CaretDown, CheckCircle, Copy } from '@phosphor-icons/react';
import type { PostRow } from './types';

// Pieces shared by the pages.

// Set from GET /summary on load, so dates and greetings follow the owner's timezone, not the browser's.
let TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
export const PILLAR: Record<string, string> = { unknown: 'Your own post' };
export function configure(owner: { timezone: string }, pillars: Record<string, string>) {
  TZ = owner.timezone;
  Object.assign(PILLAR, pillars);
}

export const prettyDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
export const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const ago = (v?: string | number) => {
  if (v === undefined) return '';
  const ms = typeof v === 'number' ? v : Date.parse(v);
  const mins = Math.round((Date.now() - ms) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ });
};
export const greeting = () => {
  const h = Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ }));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
}

export type Say = (message: string) => void;
export type Ask = (text: string) => void;

/** Page title: big, calm, one line of help under it. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-xl text-base text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-base text-muted-foreground">{children}</p>;
}

export function StatusPill({ status }: { status: PostRow['status'] }) {
  const label = status === 'draft' ? 'Draft' : status === 'posted' ? 'Posted' : status === 'rejected' ? 'Skipped' : 'Expired';
  return <span className={`pill pill-${status}`}>{status === 'posted' && <CheckCircle weight="fill" size={12} />}{label}</span>;
}

/** A "Details" fold: everything that is useful but not needed at first glance. */
export function Fold({ label = 'Details', children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="fold-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <CaretDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} /> {open ? 'Hide' : label}
      </button>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}

export function CopyButton({ text, size = 'sm' }: { text: string; size?: 'xs' | 'sm' }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="outline" size={size} onClick={async () => { setCopied(await copyText(text)); setTimeout(() => setCopied(false), 2000); }}>
      <Copy /> {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

/** The post, the way it will look on LinkedIn. */
export function PostText({ text, hashtags }: { text: string; hashtags?: string[] }) {
  return (
    <div className="post-paper">
      <p className="post-text">{text}</p>
      {hashtags && hashtags.length > 0 && <p className="mt-4 text-sm text-muted-foreground">{hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}</p>}
    </div>
  );
}
