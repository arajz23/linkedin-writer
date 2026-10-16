import { useState } from 'react';
import { lua } from '@lua-ai-global/app-client';
import { Button } from '@lua-ai-global/ui/button';
import { Input } from '@lua-ai-global/ui/input';
import { Textarea } from '@lua-ai-global/ui/textarea';
import { Star } from '@phosphor-icons/react';
import type { PageProps } from '../App';
import type { PostRow } from '../types';
import { EmptyNote, PageHeader, PostText, StatusPill, shortDate } from '../ui';

// Posts: everything posted or skipped, with a place for the numbers and a star for the ones to imitate.

export function Posts({ data, reload, say }: PageProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const done = (m: string) => { say(m); reload(); };
  return (
    <>
      <PageHeader title="Posts" subtitle="Type the numbers a few days after posting. Star the ones you're proud of: those are the ones I imitate." />

      <div className="space-y-2">
        <Button variant="outline" onClick={() => setOpen((o) => !o)}>{open ? 'Close' : 'Add a post you published yourself'}</Button>
        {open && (
          <div className="space-y-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} className="text-base leading-relaxed" placeholder="Paste the post. It joins what I learn your voice from." />
            <Button className="primary-btn" disabled={busy || text.trim().length < 40} onClick={async () => { setBusy(true); try { await lua.api('POST', '/posts', { text }); setText(''); setOpen(false); done('Saved.'); } catch (e) { say((e as Error).message); } finally { setBusy(false); } }}>Save</Button>
          </div>
        )}
      </div>

      {!data ? null : data.history.length === 0 ? <EmptyNote>Nothing here yet. Posts you mark as posted on Today, write on the Write page, or paste above show up here.</EmptyNote> : (
        <ul className="space-y-3">{data.history.map((p) => <HistoryRow key={p.id} post={p} onDone={done} />)}</ul>
      )}
    </>
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
