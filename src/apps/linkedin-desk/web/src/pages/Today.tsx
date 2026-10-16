import { useState } from 'react';
import { lua } from '@lua-ai-global/app-client';
import { Button } from '@lua-ai-global/ui/button';
import { Input } from '@lua-ai-global/ui/input';
import { Skeleton } from '@lua-ai-global/ui/skeleton';
import { Textarea } from '@lua-ai-global/ui/textarea';
import { ChatCircleText, CheckCircle, PencilSimple, Warning, X } from '@phosphor-icons/react';
import type { PageProps } from '../App';
import type { PostRow } from '../types';
import { CopyButton, EmptyNote, Fold, PILLAR, PageHeader, PostText, StatusPill, greeting, prettyDate } from '../ui';

// Today: a greeting, the two drafts, and the three buttons that matter on each.

export function Today({ data, reload, say, ask }: PageProps) {
  const [steer, setSteer] = useState('');
  const [writing, setWriting] = useState(false);
  const pending = data?.drafts.filter((d) => d.status === 'draft').length ?? 0;
  const writeNow = async () => {
    setWriting(true);
    try { await lua.api('POST', '/run', { what: 'draft', note: steer.trim() || undefined }); say('Writing. Two drafts land here and in your email in 3 to 6 minutes.'); setSteer(''); }
    catch (e) { say((e as Error).message); } finally { setWriting(false); }
  };

  return (
    <>
      <PageHeader
        title={data ? `${greeting()}, ${data.owner.first}` : greeting()}
        subtitle={data?.draftsDate ? `Two drafts for ${prettyDate(data.draftsDate)}. Post 1 is the one I'd run.` : 'Nothing waiting. The first drafts arrive at 06:30, or ask for them now.'}
      />

      <div className="callout space-y-3">
        <p className="text-sm font-medium">Want a draft right now?</p>
        <div className="flex flex-col gap-2 @xl:flex-row">
          <Input value={steer} onChange={(e) => setSteer(e.target.value)} placeholder="Optional: what it should be about, and the mood" />
          <Button className="primary-btn shrink-0" onClick={writeNow} disabled={writing}><PencilSimple weight="bold" /> {writing ? 'Starting' : 'Write now'}</Button>
        </div>
      </div>

      {!data ? <Skeleton className="h-72 rounded-2xl" /> : data.drafts.length === 0 ? (
        <EmptyNote>No drafts yet. Press <b>Write now</b> and they appear here in a few minutes.</EmptyNote>
      ) : (
        <div className="space-y-8">
          {pending === 0 && <p className="text-sm text-muted-foreground">Both drafts are dealt with. Tomorrow's come at 06:30.</p>}
          {data.drafts.map((d) => <DraftCard key={d.id} post={d} onDone={(m) => { say(m); reload(); }} onAsk={ask} />)}
        </div>
      )}
    </>
  );
}

function DraftCard({ post, onDone, onAsk }: { post: PostRow; onDone: (m: string) => void; onAsk: (t: string) => void }) {
  const [mode, setMode] = useState<'idle' | 'edited' | 'rejecting'>('idle');
  const [finalText, setFinalText] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const full = `${post.draft}\n\n${post.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}`;
  const done = post.status !== 'draft';

  const send = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true);
    try { await lua.api('POST', `/drafts/${encodeURIComponent(post.id)}`, body); onDone(msg); setMode('idle'); }
    catch (e) { onDone((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-xl font-semibold">Post {post.rank}</h2>
        <span className="text-sm text-muted-foreground">{PILLAR[post.pillar] ?? post.pillar}</span>
        <StatusPill status={post.status} />
      </div>
      <p className="text-base text-muted-foreground">{post.topic}</p>

      <PostText text={post.status === 'posted' && post.finalText ? post.finalText : post.draft} hashtags={post.hashtags} />

      {post.check && (
        <p className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm leading-relaxed" style={{ background: 'color-mix(in oklab, var(--status-warning) 12%, transparent)' }}>
          <Warning weight="fill" size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--status-warning)' }} />
          <span><b>Before posting:</b> {post.check}</span>
        </p>
      )}

      {!done ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="lg" className="primary-btn" disabled={busy} onClick={() => send({ action: 'posted' }, 'Noted: posted as written. Tell me the numbers in a few days.')}><CheckCircle weight="bold" /> I posted it</Button>
            <Button size="lg" variant="outline" disabled={busy} onClick={() => setMode(mode === 'edited' ? 'idle' : 'edited')}><PencilSimple /> I changed it</Button>
            <Button size="lg" variant="outline" disabled={busy} onClick={() => setMode(mode === 'rejecting' ? 'idle' : 'rejecting')}><X /> Not this one</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={full} />
            <Button variant="ghost" size="sm" onClick={() => onAsk(`Rewrite post ${post.rank} ("${post.topic}"). Keep my voice; make the hook sharper and the whole thing tighter. Give me the full post.`)}><ChatCircleText /> Ask for a rewrite</Button>
          </div>
          {mode === 'edited' && (
            <div className="space-y-2">
              <Textarea value={finalText} onChange={(e) => setFinalText(e.target.value)} rows={9} placeholder="Paste exactly what you posted. Your edits teach me more than anything else." />
              <Button className="primary-btn" disabled={busy || finalText.trim().length < 40} onClick={() => send({ action: 'posted', finalText }, 'Got it. I compared it with my draft and will learn from the edits.')}>Save what I posted</Button>
            </div>
          )}
          {mode === 'rejecting' && (
            <div className="flex flex-col gap-2 @xl:flex-row">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why not? 'too generic', 'not my opinion', 'client identifiable'..." />
              <Button variant="destructive" className="shrink-0" disabled={busy} onClick={() => send({ action: 'rejected', reason }, 'Noted. That shapes tomorrow.')}>Skip it</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2"><CopyButton text={full} />{post.rejectReason && <p className="self-center text-sm text-muted-foreground">You said: {post.rejectReason}</p>}</div>
      )}

      <Fold>
        {post.altHooks.length > 0 && (
          <div className="space-y-2 text-sm">
            <p className="font-medium">Other openings</p>
            {post.altHooks.map((h, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 w-4 shrink-0 text-xs font-semibold text-muted-foreground">{String.fromCharCode(66 + i)}</span>
                <span className="flex-1">{h}</span>
                {!done && <Button variant="ghost" size="xs" disabled={busy} onClick={() => send({ action: 'posted', altHook: i === 0 ? 'B' : 'C' }, `Noted: posted with opening ${String.fromCharCode(66 + i)}.`)}>Posted with this</Button>}
              </div>
            ))}
          </div>
        )}
        {post.judgeNote && <p className="text-sm text-muted-foreground"><b className="text-foreground">Why this one</b> ({post.judge ?? '?'}/100): {post.judgeNote}</p>}
        {post.visual && post.visual !== 'none' && <p className="text-sm text-muted-foreground"><b className="text-foreground">Visual idea:</b> {post.visual}</p>}
        <p className="text-sm text-muted-foreground"><b className="text-foreground">Sources:</b> {post.sources.join(' · ')}</p>
      </Fold>
    </article>
  );
}
