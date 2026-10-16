import { useState } from 'react';
import { lua } from '@lua-ai-global/app-client';
import { Button } from '@lua-ai-global/ui/button';
import { Input } from '@lua-ai-global/ui/input';
import { Trash } from '@phosphor-icons/react';
import type { PageProps } from '../App';
import { PageHeader, ago } from '../ui';

// Reading: the sources the intake reads four times a day. Paste any Substack or site to add it.

export function Reading({ data, reload, say }: PageProps) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try {
      const r = await lua.api<{ added: boolean; name?: string; error?: string; note?: string }>('POST', '/sources', { url });
      if (r.added) { setUrl(''); say(`Added ${r.name}.`); reload(); } else say(r.error ?? r.note ?? 'Not added.');
    } catch (e) { say((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="What it reads" subtitle="Four times a day. Paste a Substack, a blog or a news site and it joins the list. Paid newsletters: label them 'LinkedIn Reading' in Gmail." />
      <div className="flex flex-col gap-2 @xl:flex-row">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://someone.substack.com" className="text-base" onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <Button size="lg" className="primary-btn shrink-0" disabled={busy || url.trim().length < 4} onClick={add}>{busy ? 'Checking' : 'Add'}</Button>
      </div>
      {data && (
        <ul>
          {data.sources.map((s) => {
            const bad = s.lastStatus && s.lastStatus !== 'ok';
            return (
              <li key={s.id} className="row">
                <span className="dot" style={{ background: bad ? 'var(--status-critical)' : s.lastStatus ? 'var(--status-good)' : 'var(--muted-foreground)' }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="shrink-0 text-sm text-muted-foreground">{bad ? 'not working' : s.lastRead ? `${s.lastCount ?? 0} · ${ago(s.lastRead)}` : 'not read yet'}</span>
                <Button variant="ghost" size="icon-xs" aria-label={`Stop reading ${s.name}`} onClick={async () => { await lua.api('DELETE', `/sources/${encodeURIComponent(s.id)}`); say(`Stopped reading ${s.name}.`); reload(); }}><Trash /></Button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
