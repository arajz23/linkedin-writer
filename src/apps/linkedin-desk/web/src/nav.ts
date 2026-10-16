import { useCallback, useEffect, useState } from 'react';
import { lua } from '@lua-ai-global/app-client';
import { BookOpenText, ChartBar, Gear, Lightbulb, Microphone, PencilLine, SunHorizon } from '@phosphor-icons/react';

// One menu entry per page. The same paths are listed in app.ts pages.nav so the Workspace shell can link to a page.

export type SectionKey = 'today' | 'write' | 'tell' | 'voice' | 'posts' | 'reading' | 'health';

export const SECTIONS: { key: SectionKey; path: string; label: string; hint: string; Icon: typeof SunHorizon }[] = [
  { key: 'today', path: '/', label: 'Today', hint: 'The two drafts', Icon: SunHorizon },
  { key: 'write', path: '/write', label: 'Write', hint: 'Your draft, made to land', Icon: PencilLine },
  { key: 'tell', path: '/tell', label: 'Tell me', hint: 'Stories and links', Icon: Lightbulb },
  { key: 'voice', path: '/voice', label: 'My voice', hint: 'Rules and what it learned', Icon: Microphone },
  { key: 'posts', path: '/posts', label: 'Posts', hint: 'History and numbers', Icon: ChartBar },
  { key: 'reading', path: '/reading', label: 'Reading', hint: 'What it reads', Icon: BookOpenText },
  { key: 'health', path: '/health', label: 'Running', hint: 'Is it working', Icon: Gear },
];

const fromPath = (path?: string): SectionKey => {
  const p = (path ?? '/').replace(/\/+$/, '') || '/';
  return SECTIONS.find((s) => s.path === p)?.key ?? 'today';
};

/** Client-side routing: follows the URL, the shell's init path, and the browser's back/forward. */
export function useSection() {
  const [section, setSection] = useState<SectionKey>(() => fromPath(window.location.pathname));
  useEffect(() => {
    const onPop = () => setSection(fromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    lua.onInit((init) => { if (init.path) setSection(fromPath(init.path)); });
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const go = useCallback((key: SectionKey) => {
    const path = SECTIONS.find((s) => s.key === key)?.path ?? '/';
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    setSection(key);
    window.scrollTo({ top: 0 });
  }, []);
  return [section, go] as const;
}
