import { useState } from 'react';
import { lua } from '@lua-ai-global/app-client';
import { Button } from '@lua-ai-global/ui/button';
import { Input } from '@lua-ai-global/ui/input';
import { Textarea } from '@lua-ai-global/ui/textarea';
import { ArrowCounterClockwise, CheckCircle, Sparkle, Warning } from '@phosphor-icons/react';
import type { PageProps } from '../App';
import type { Improved } from '../types';
import { CopyButton, PageHeader, PostText } from '../ui';

// Write: the owner's own words in, the same post made to land in his voice out, with what changed and why.
// Nothing is invented; a gap becomes a [bracketed prompt].

export function Write({ say, reload }: PageProps) {
  const [text, setText] = useState('');
  const [steer, setSteer] = useState('');
  const [result, setResult] = useState<Improved>();
  const [edited, setEdited] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const improve = async (extraSteer?: string) => {
    setBusy(true);
    try {
      const r = await lua.api<Improved>('POST', '/improve', { text, steer: [steer, extraSteer].filter(Boolean).join('. ') || undefined });
      setResult(r);
      setEdited(r.improved);
    } catch (e) { say((e as Error).message); } finally { setBusy(false); }
  };

  const posted = async () => {
    setSaving(true);
    try {
      await lua.api('POST', '/posts', { text: edited, original: text });
      say('Saved as posted. I learn from the difference between your draft and this.');
      setResult(undefined); setText(''); setSteer(''); reload();
    } catch (e) { say((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Write" subtitle="Type or paste your post. I keep every fact and every opinion, and make it land the way your best posts do." />

      <div className="space-y-3">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={result ? 6 : 12} placeholder="Your draft, as rough as you like. Half-sentences are fine." className="text-base leading-relaxed" />
        <div className="flex flex-col gap-2 @xl:flex-row">
          <Input value={steer} onChange={(e) => setSteer(e.target.value)} placeholder="Optional: 'shorter', 'angrier', 'keep the joke', 'for CFOs'" />
          <Button size="lg" className="primary-btn shrink-0" disabled={busy || text.trim().length < 40} onClick={() => improve()}>
            <Sparkle weight="fill" /> {busy ? 'Working' : result ? 'Again' : 'Make it mine'}
          </Button>
        </div>
      </div>

      {result && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">Your post, sharpened</h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => improve('shorter, cut a third')}><ArrowCounterClockwise /> Shorter</Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => improve('more opinionated, take a clearer side')}><ArrowCounterClockwise /> Bolder</Button>
            </div>
          </div>

          <Textarea value={edited} onChange={(e) => setEdited(e.target.value)} rows={12} className="post-paper post-text border-0 focus-visible:ring-1" />

          <div className="flex flex-wrap gap-2">
            <Button size="lg" className="primary-btn" disabled={saving || edited.trim().length < 40} onClick={posted}><CheckCircle weight="bold" /> I posted this</Button>
            <CopyButton text={edited} />
          </div>

          {result.check && (
            <p className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm leading-relaxed" style={{ background: 'color-mix(in oklab, var(--status-warning) 12%, transparent)' }}>
              <Warning weight="fill" size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--status-warning)' }} /><span><b>Check first:</b> {result.check}</span>
            </p>
          )}

          <div className="grid gap-4 @2xl:grid-cols-2">
            <div className="callout space-y-2">
              <p className="text-sm font-semibold">What I changed</p>
              <ul className="space-y-1.5 text-sm leading-relaxed">{result.changes.map((c, i) => <li key={i} className="flex gap-2"><span className="text-muted-foreground">·</span><span>{c}</span></li>)}</ul>
            </div>
            <div className="callout space-y-2">
              <p className="text-sm font-semibold">Other ways to open</p>
              <ul className="space-y-2 text-sm leading-relaxed">
                {result.altHooks.map((h, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="flex-1">{h}</span>
                    <Button variant="ghost" size="xs" onClick={() => setEdited([h, ...edited.split('\n').slice(1)].join('\n'))}>Use</Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer">Your original</summary>
            <div className="mt-3"><PostText text={result.original} /></div>
          </details>
        </section>
      )}
    </>
  );
}
