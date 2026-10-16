import { useState } from 'react';
import { lua } from '@lua-ai-global/app-client';
import { Badge } from '@lua-ai-global/ui/badge';
import { Button } from '@lua-ai-global/ui/button';
import { Input } from '@lua-ai-global/ui/input';
import { Textarea } from '@lua-ai-global/ui/textarea';
import { ChatCircleText, Trash } from '@phosphor-icons/react';
import type { PageProps } from '../App';
import { EmptyNote, PageHeader, shortDate } from '../ui';

// Tell me: your own stories (worth more than any news), links worth a post, and what the writer is sitting on.

export function Tell({ data, reload, say, ask }: PageProps) {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const saveSeed = async () => {
    setBusy(true);
    try { await lua.api('POST', '/seed', { text, kind: 'anecdote' }); setText(''); say('Saved. It goes into tomorrow\'s material.'); reload(); }
    catch (e) { say((e as Error).message); } finally { setBusy(false); }
  };
  const sendLink = async () => {
    setBusy(true);
    try {
      const r = await lua.api<{ read: boolean; title?: string; error?: string }>('POST', '/link', { url, note: note || undefined });
      if (r.read) { setUrl(''); setNote(''); say(`Read "${r.title}" and filed it.`); reload(); } else say(r.error ?? 'Could not read that page.');
    } catch (e) { say((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Tell me something" subtitle="A client call, a demo, a hire, a mistake, an opinion. Two lines in your own words beat any article." />

      <div className="space-y-3">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className="text-base leading-relaxed" placeholder="e.g. The CFO asked whether the agent speaks the local language before anything else. It does. Nobody asked about accuracy." />
        <Button size="lg" className="primary-btn" disabled={busy || text.trim().length < 10} onClick={saveSeed}>Save it</Button>
      </div>

      <div className="callout space-y-3">
        <p className="text-sm font-semibold">A link worth a post</p>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why it matters, or your take (optional)" />
        <Button variant="outline" disabled={busy || !/^https?:\/\//.test(url.trim())} onClick={sendLink}>{busy ? 'Reading' : 'Read and file it'}</Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What you've told me, not used yet</h2>
        {!data ? null : data.material.seeds.length === 0 ? <EmptyNote>Nothing yet. Whatever you save above shows here until a draft uses it.</EmptyNote> : (
          <ul className="space-y-2">
            {data.material.seeds.map((s) => (
              <li key={s.id} className="flex items-start gap-3 rounded-2xl bg-muted/50 px-5 py-4 text-base leading-relaxed">
                <p className="min-w-0 flex-1">{s.text}<span className="ml-2 text-sm text-muted-foreground">{shortDate(s.at)}</span></p>
                <Button variant="ghost" size="icon-xs" aria-label="Drop" onClick={async () => { await lua.api('DELETE', `/seed/${encodeURIComponent(s.id)}`); reload(); }}><Trash /></Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Stories I'm sitting on</h2>
        <p className="text-sm text-muted-foreground">The best of what I read this week, scored for you out of 100.</p>
        {!data ? null : data.material.stories.length === 0 ? <EmptyNote>Nothing scored yet. The next read is within a few hours.</EmptyNote> : (
          <ul className="space-y-2">
            {data.material.stories.map((s) => (
              <li key={s.id} className="rounded-2xl bg-muted/50 px-5 py-4 text-base">
                <p className="flex items-start gap-2">
                  <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 font-medium leading-snug underline-offset-2 hover:underline">{s.title}</a>
                  {s.fromOwner && <Badge variant="secondary">yours</Badge>}
                  <span className="shrink-0 text-sm text-muted-foreground">{s.score}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{s.source}{s.published ? ` · ${shortDate(s.published)}` : ''}</p>
                {s.angleHint && <p className="mt-2 text-sm leading-relaxed">{s.angleHint}</p>}
                <Button variant="ghost" size="xs" className="-ml-2 mt-1" onClick={() => ask(`Write today's post about this: ${s.title} (${s.url}). Give me the full post.`)}><ChatCircleText /> Write about this</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
