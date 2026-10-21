import { useRef, useState } from 'react';
import { lua } from '@lua-ai-global/app-client';
import { Button } from '@lua-ai-global/ui/button';
import { Input } from '@lua-ai-global/ui/input';
import { Textarea } from '@lua-ai-global/ui/textarea';
import { Camera, ChartBar, Star, UploadSimple } from '@phosphor-icons/react';
import type { PageProps } from '../App';
import type { MetricRow, PostRow, ReadPost } from '../types';
import { EmptyNote, PageHeader, PostText, StatusPill, shortDate } from '../ui';
import { imageToDataUrl, parseAnalytics } from '../analytics';

// Posts: everything posted or skipped, with a place for the numbers and a star for the ones to imitate. Posts
// come in three ways: marked posted on Today, pasted or written here, or read from a screenshot. Numbers come in
// by hand, from a screenshot, or from LinkedIn's analytics export.

export function Posts({ data, reload, say }: PageProps) {
  const done = (m: string) => { say(m); reload(); };
  return (
    <>
      <PageHeader title="Posts" subtitle="Type the numbers a few days after posting, or upload LinkedIn's export once a month. Star the ones you're proud of: those are the ones I imitate." />

      <div className="grid gap-4 @2xl:grid-cols-2">
        <FromScreenshot onDone={done} say={say} />
        <UploadAnalytics onDone={done} say={say} />
      </div>
      <PasteOwnPost onDone={done} say={say} />

      {!data ? null : data.history.length === 0 ? <EmptyNote>Nothing here yet. Posts you mark as posted on Today, write on the Write page, paste or screenshot above show up here.</EmptyNote> : (
        <ul className="space-y-3">{data.history.map((p) => <HistoryRow key={p.id} post={p} onDone={done} />)}</ul>
      )}
    </>
  );
}

function FromScreenshot({ onDone, say }: { onDone: (m: string) => void; say: (m: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState<ReadPost>();
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [url, setUrl] = useState('');
  const [m, setM] = useState({ impressions: '', reactions: '', comments: '', reposts: '' });

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const image = await imageToDataUrl(file);
      const r = await lua.api<ReadPost>('POST', '/posts/from-image', { image });
      setRead(r); setText(r.text); setDate(r.date ?? '');
      setM({ impressions: r.impressions?.toString() ?? '', reactions: r.reactions?.toString() ?? '', comments: r.comments?.toString() ?? '', reposts: r.reposts?.toString() ?? '' });
      if (!r.text) say('I could not read any post text in that image.');
    } catch (e) { say((e as Error).message); } finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  const save = async () => {
    setBusy(true);
    const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
    try {
      await lua.api('POST', '/posts', { text, date: date || undefined, postUrl: url || undefined, metrics: { impressions: num(m.impressions), reactions: num(m.reactions), comments: num(m.comments), reposts: num(m.reposts) } });
      setRead(undefined); setText(''); setDate(''); setUrl('');
      onDone('Saved from the screenshot.');
    } catch (e) { say((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="callout space-y-3">
      <p className="flex items-center gap-2 text-sm font-semibold"><Camera weight="duotone" className="accent-text" size={18} /> Add from a screenshot</p>
      <p className="text-sm text-muted-foreground">A screenshot of your post from the LinkedIn app or site. I read the text and the numbers on screen; you check and save.</p>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}><UploadSimple /> {busy && !read ? 'Reading' : 'Choose a screenshot'}</Button>
      {read && (
        <div className="space-y-2">
          {read.note && <p className="text-xs text-muted-foreground">{read.note}</p>}
          {read.confidence !== 'high' && <p className="text-xs text-muted-foreground">I'm not fully sure I read everything right; check the text.</p>}
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className="text-base leading-relaxed" />
          <div className="flex flex-wrap gap-2">
            <label className="text-xs text-muted-foreground">posted on<Input type="date" className="mt-1 w-40" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            {(['impressions', 'reactions', 'comments', 'reposts'] as const).map((k) => (
              <label key={k} className="text-xs text-muted-foreground">{k}<Input type="number" min={0} className="mt-1 w-24" value={m[k]} onChange={(e) => setM({ ...m, [k]: e.target.value })} /></label>
            ))}
          </div>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Post URL (optional, lets the analytics export match it)" />
          <div className="flex gap-2">
            <Button className="primary-btn" disabled={busy || text.trim().length < 40} onClick={save}>Save as posted</Button>
            <Button variant="ghost" disabled={busy} onClick={() => setRead(undefined)}>Discard</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadAnalytics({ onDone, say }: { onDone: (m: string) => void; say: (m: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<MetricRow[]>();
  const [name, setName] = useState('');

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const { rows: parsed, sheets } = parseAnalytics(await file.arrayBuffer(), file.name);
      if (!parsed.length) { say('No post rows found. The export needs a "Post URL" column (the TOP POSTS sheet has one).'); return; }
      setRows(parsed); setName(`${file.name}${sheets.length ? ` (${sheets.join(', ')})` : ''}`);
    } catch (e) { say((e as Error).message); } finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  const send = async () => {
    if (!rows) return;
    setBusy(true);
    try {
      const r = await lua.api<{ matched: number; created: number; skipped: number; unmatched: number }>('POST', '/metrics/import', { rows });
      setRows(undefined);
      onDone(`${r.matched} post${r.matched === 1 ? '' : 's'} updated, ${r.created} new post stub${r.created === 1 ? '' : 's'} created${r.unmatched ? `, ${r.unmatched} rows without a URL skipped` : ''}.`);
    } catch (e) { say((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="callout space-y-3">
      <p className="flex items-center gap-2 text-sm font-semibold"><ChartBar weight="duotone" className="accent-text" size={18} /> Upload LinkedIn analytics</p>
      <p className="text-sm text-muted-foreground">LinkedIn: Analytics, Post analytics, Export (an .xlsx). Rows match your posts by URL, then by date. Do it monthly; the review on the 1st reads the numbers.</p>
      <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}><UploadSimple /> Choose the export</Button>
      {rows && (
        <div className="space-y-2 text-sm">
          <p>{rows.length} post{rows.length === 1 ? '' : 's'} in {name}: {rows.filter((r) => r.impressions !== undefined).length} with impressions, {rows.filter((r) => r.engagements !== undefined).length} with engagements{rows.some((r) => r.date) ? ', dates found' : ''}.</p>
          <div className="flex gap-2">
            <Button className="primary-btn" disabled={busy} onClick={send}>Import</Button>
            <Button variant="ghost" disabled={busy} onClick={() => setRows(undefined)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PasteOwnPost({ onDone, say }: { onDone: (m: string) => void; say: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={() => setOpen((o) => !o)}>{open ? 'Close' : 'Paste a post you published yourself'}</Button>
      {open && (
        <div className="space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} className="text-base leading-relaxed" placeholder="Paste the post. It joins what I learn your voice from." />
          <Button className="primary-btn" disabled={busy || text.trim().length < 40} onClick={async () => { setBusy(true); try { await lua.api('POST', '/posts', { text }); setText(''); setOpen(false); onDone('Saved.'); } catch (e) { say((e as Error).message); } finally { setBusy(false); } }}>Save</Button>
        </div>
      )}
    </div>
  );
}

function HistoryRow({ post, onDone }: { post: PostRow; onDone: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [m, setM] = useState({ impressions: post.metrics?.impressions ?? '', reactions: post.metrics?.reactions ?? '', comments: post.metrics?.comments ?? '' });
  const [busy, setBusy] = useState(false);
  const save = async (extra: Record<string, unknown> = {}) => {
    setBusy(true);
    const num = (v: string | number) => (v === '' ? undefined : Number(v));
    try { await lua.api('POST', `/posts/${encodeURIComponent(post.id)}/metrics`, { impressions: num(m.impressions), reactions: num(m.reactions), comments: num(m.comments), ...extra }); onDone('Saved.'); }
    catch (e) { onDone((e as Error).message); } finally { setBusy(false); }
  };
  const text = post.finalText ?? post.draft;
  const numbers = post.metrics && (post.metrics.impressions || post.metrics.reactions || post.metrics.comments) ? `${post.metrics.impressions ?? 0} views · ${post.metrics.reactions ?? 0} reactions · ${post.metrics.comments ?? 0} comments` : undefined;
  return (
    <li className="rounded-2xl border border-border px-5 py-4">
      <div className="flex items-center gap-3">
        <button type="button" className="shrink-0" aria-label={post.favourite ? 'Unstar' : 'Star: one of my best'} onClick={() => save({ favourite: !post.favourite })}>
          <Star size={22} weight={post.favourite ? 'fill' : 'regular'} style={{ color: post.favourite ? 'var(--status-warning)' : 'var(--muted-foreground)' }} />
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen((o) => !o)}>
          <p className="truncate text-base font-medium">{post.hook || post.topic}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{shortDate(post.date)}{numbers ? ` · ${numbers}` : ''}{post.editRatio !== undefined && post.editRatio > 0.05 ? ` · you changed ${Math.round(post.editRatio * 100)}%` : ''}{post.rejectReason ? ` · skipped: ${post.rejectReason}` : ''}</p>
        </button>
        <StatusPill status={post.status} />
      </div>
      {open && (
        <div className="mt-4 space-y-4">
          <PostText text={text} hashtags={post.hashtags} />
          {post.postUrl && <a href={post.postUrl} target="_blank" rel="noreferrer" className="text-sm underline-offset-2 hover:underline">Open on LinkedIn</a>}
          {post.status === 'posted' && (
            <div className="flex flex-wrap items-end gap-3">
              {(['impressions', 'reactions', 'comments'] as const).map((k) => (
                <label key={k} className="text-sm text-muted-foreground">{k}<Input type="number" min={0} className="mt-1 w-28 text-base" value={m[k]} onChange={(e) => setM({ ...m, [k]: e.target.value })} /></label>
              ))}
              <Button className="primary-btn" disabled={busy} onClick={() => save()}>Save numbers</Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
