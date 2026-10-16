import { useState } from 'react';
import { lua } from '@lua-ai-global/app-client';
import { Button } from '@lua-ai-global/ui/button';
import { Input } from '@lua-ai-global/ui/input';
import { ChatCircleText } from '@phosphor-icons/react';
import type { PageProps } from '../App';
import { EmptyNote, PageHeader, shortDate } from '../ui';

// My voice: the rules the owner gives, and what the Sunday review learned from his posts, edits and rejections.

export function Voice({ data, reload, say, ask }: PageProps) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try { await lua.api('POST', '/note', { note }); setNote(''); say('Noted. Applies from the next draft.'); reload(); }
    catch (e) { say((e as Error).message); } finally { setBusy(false); }
  };
  const p = data?.voice.profile;

  return (
    <>
      <PageHeader title="My voice" subtitle="Tell me a rule and it applies from the next draft. Every Sunday I reread what you posted, changed and rejected, and update what I know." />

      <div className="space-y-3">
        <div className="flex flex-col gap-2 @xl:flex-row">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder='A rule, e.g. "never open with a question"' className="text-base" onKeyDown={(e) => { if (e.key === 'Enter' && note.trim().length >= 5) add(); }} />
          <Button size="lg" className="primary-btn shrink-0" disabled={busy || note.trim().length < 5} onClick={add}>Add rule</Button>
        </div>
        {data && data.voice.notes.length > 0 && (
          <ul className="space-y-2">
            {data.voice.notes.map((n, i) => (
              <li key={i} className="flex items-baseline gap-3 rounded-2xl bg-muted/50 px-5 py-3 text-base"><span className="shrink-0 text-sm text-muted-foreground">{shortDate(n.at)}</span><span>{n.note}</span></li>
            ))}
          </ul>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What I've learned</h2>
        {!p ? (
          <div className="space-y-3">
            <EmptyNote>No review yet. Import your past posts first (see the README) so the first review learns from your real voice, then it runs every Sunday at 16:00.</EmptyNote>
            <Button variant="outline" onClick={() => ask("What have you learned about my voice so far? Be honest about what you don't know yet.")}><ChatCircleText /> Ask me anyway</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Reviewed {shortDate(p.at)} from {p.sampleSize} posts</p>
            <p className="callout text-base leading-relaxed">{p.summary}</p>
            <ul className="space-y-3">
              {p.rules.map((r, i) => (
                <li key={i} className="rounded-2xl border border-border px-5 py-4">
                  <p className="text-base font-medium">{r.rule}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{r.confidence} · {r.evidence}</p>
                </li>
              ))}
            </ul>
            {p.hooksThatWork.length > 0 && <div><p className="text-sm font-semibold">Openings that work for you</p><ul className="mt-2 space-y-1 text-base">{p.hooksThatWork.map((h, i) => <li key={i}>{h}</li>)}</ul></div>}
            {p.learnings.length > 0 && <div><p className="text-sm font-semibold">Changed lately</p><ul className="mt-2 space-y-1 text-sm text-muted-foreground">{p.learnings.map((l, i) => <li key={i}>{l}</li>)}</ul></div>}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Always on</h2>
        <p className="text-sm text-muted-foreground">Hook first, under 15 words. One idea, one opinion, one concrete detail. 100 to 220 words. No em dashes, no "not X but Y", no AI words, no listicles. Clients anonymous unless public. Nothing invented.</p>
      </section>
    </>
  );
}
