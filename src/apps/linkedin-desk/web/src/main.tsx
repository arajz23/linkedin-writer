import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { lua } from '@lua-ai-global/app-client';
import { AgentPaneLayout } from '@lua-ai-global/app-chat';
import './index.css';

// Theme follows the shell: first from the bootstrap, then from the host's `init`.
document.documentElement.classList.toggle('dark', lua.theme === 'dark');
lua.onInit((init) => document.documentElement.classList.toggle('dark', init.theme === 'dark'));

// On a phone the chat is a bottom sheet that would cover the page, so it starts closed the first time; the pane
// remembers whatever the owner does with it after that (the corner button opens it).
const PANE_KEY = 'linkedin-desk:agent-pane';
try { if (window.innerWidth < 768 && localStorage.getItem(PANE_KEY) === null) localStorage.setItem(PANE_KEY, 'closed'); } catch { /* storage may be blocked in the frame */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The agent pane: the owner's own chat with the writer, docked beside the page. After every reply the page
        refetches, because the agent's tools may have changed what it shows (a draft marked posted, a seed saved). */}
    <AgentPaneLayout
      storageKey={PANE_KEY}
      context={() => ({ app: 'LinkedIn desk' })}
      onTurnEnd={() => window.dispatchEvent(new Event('desk:refresh'))}
    >
      <App />
    </AgentPaneLayout>
  </StrictMode>
);
void lua.start();
