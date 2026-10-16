import { useCallback, useEffect, useState } from 'react';
import { lua, LuaApiError } from '@lua-ai-global/app-client';
import { useAgentPane } from '@lua-ai-global/app-chat';
import { Card, CardContent } from '@lua-ai-global/ui/card';
import { Button } from '@lua-ai-global/ui/button';
import { ArrowClockwise, LinkedinLogo } from '@phosphor-icons/react';
import { SECTIONS, type SectionKey, useSection } from './nav';
import type { Summary } from './types';
import { Today } from './pages/Today';
import { Write } from './pages/Write';
import { Tell } from './pages/Tell';
import { Voice } from './pages/Voice';
import { Posts } from './pages/Posts';
import { Reading } from './pages/Reading';
import { Health, isFailing } from './pages/Health';
import { ago, configure } from './ui';

// The shell: a menu on the left (a scrollable bar on a phone), one page at a time, the writer's chat docked by
// the host. Every page gets the same summary and the same three callbacks: reload, say (a toast), ask (the chat).

export function App() {
  const pane = useAgentPane();
  const [section, go] = useSection();
  const [data, setData] = useState<Summary>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string>();

  const load = useCallback(() => {
    setLoading(true);
    lua.api<Summary>('GET', '/summary')
      .then((s) => { configure(s.owner, s.pillars); setData(s); setError(undefined); })
      .catch((e: unknown) => setError(e instanceof LuaApiError && e.status === 403 ? 'This desk belongs to someone else.' : (e as Error).message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    const onRefresh = () => load();
    window.addEventListener('desk:refresh', onRefresh);
    return () => window.removeEventListener('desk:refresh', onRefresh);
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(undefined), 3500); return () => clearTimeout(t); }, [toast]);

  const say = (m: string) => setToast(m);
  const ask = (text: string) => pane.ask(text);

  if (error && !data) {
    return <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground"><Card><CardContent className="py-10 text-center text-muted-foreground">{error}</CardContent></Card></main>;
  }

  const pending = data?.drafts.filter((d) => d.status === 'draft').length ?? 0;
  const failing = data?.automations.filter(isFailing).length ?? 0;
  const badges: Partial<Record<SectionKey, { n: number; urgent?: boolean }>> = { today: { n: pending }, health: { n: failing, urgent: true } };
  const props = { data, reload: load, say, ask };

  return (
    <div className="@container min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen flex-col @3xl:flex-row">
        <nav aria-label="Pages" className="app-nav @3xl:sticky @3xl:top-0 @3xl:h-screen @3xl:w-64 @3xl:shrink-0">
          <div className="hidden items-center gap-3 px-5 pb-5 pt-7 @3xl:flex">
            <span className="brand-mark size-9 rounded-xl"><LinkedinLogo weight="fill" size={18} /></span>
            <div>
              <p className="text-sm font-semibold leading-tight">LinkedIn desk</p>
              <p className="text-xs text-muted-foreground">{data ? `${data.owner.first}'s writer` : 'your writer'}</p>
            </div>
          </div>
          <ul className="flex gap-1 overflow-x-auto px-3 py-2 @3xl:flex-col @3xl:gap-1.5 @3xl:overflow-visible @3xl:px-4 @3xl:py-0">
            {SECTIONS.map(({ key, label, hint, Icon }) => {
              const b = badges[key];
              const active = section === key;
              return (
                <li key={key} className="shrink-0">
                  <button type="button" aria-current={active ? 'page' : undefined} className="nav-item" onClick={() => go(key)}>
                    <span className="accent-tile size-8 rounded-lg"><Icon size={17} weight={active ? 'fill' : 'duotone'} /></span>
                    <span><span>{label}</span><span className="nav-hint hidden @3xl:block">{hint}</span></span>
                    {b && b.n > 0 && <span className={`nav-badge ${b.urgent ? 'is-urgent' : ''}`}>{b.n}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-auto hidden space-y-2 px-5 pb-6 pt-4 text-xs text-muted-foreground @3xl:block">
            {data && <p>Updated {ago(data.generatedAt)}</p>}
            <Button variant="ghost" size="xs" className="-ml-2" onClick={load} disabled={loading}><ArrowClockwise className={loading ? 'animate-spin' : ''} /> Refresh</Button>
          </div>
        </nav>

        <main className="min-w-0 flex-1 px-5 pb-24 pt-6 @3xl:px-12 @3xl:pt-10">
          <div className="page mx-auto space-y-8">
            {section === 'today' && <Today {...props} />}
            {section === 'write' && <Write {...props} />}
            {section === 'tell' && <Tell {...props} />}
            {section === 'voice' && <Voice {...props} />}
            {section === 'posts' && <Posts {...props} />}
            {section === 'reading' && <Reading {...props} />}
            {section === 'health' && <Health {...props} />}
          </div>
        </main>
      </div>
      {toast && <div role="status" className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background shadow-lg">{toast}</div>}
    </div>
  );
}

export interface PageProps { data?: Summary; reload: () => void; say: (m: string) => void; ask: (t: string) => void }
