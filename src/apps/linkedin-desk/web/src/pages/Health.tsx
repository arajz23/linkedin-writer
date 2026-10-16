import { lua } from '@lua-ai-global/app-client';
import { Button } from '@lua-ai-global/ui/button';
import type { PageProps } from '../App';
import type { AutomationRow } from '../types';
import { PageHeader, ago } from '../ui';

// Running: the four things that run on their own, and how the last run went.

export const isFailing = (r: AutomationRow) => !!r.lastStatus && !['completed', 'running', 'queued', 'waiting', 'suspended'].includes(r.lastStatus);

export function Health({ data, say }: PageProps) {
  const run = async (what: 'draft' | 'intake' | 'review') => {
    try {
      await lua.api('POST', '/run', { what });
      say(what === 'intake' ? 'Reading everything now. A few minutes.' : what === 'review' ? 'Rebuilding your voice profile. The report comes by email.' : 'Writing. Drafts land on Today and in your email in a few minutes.');
    } catch (e) { say((e as Error).message); }
  };
  return (
    <>
      <PageHeader title="Is it running?" subtitle="The four things that run on their own, in your timezone, and how the last run went." />
      {data && (
        <ul>
          {data.automations.map((r) => (
            <li key={r.name} className="row flex-wrap">
              <span className="dot" style={{ background: !r.lastStatus ? 'var(--muted-foreground)' : isFailing(r) ? 'var(--status-critical)' : 'var(--status-good)' }} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{r.label}</span>
                <span className="block text-sm text-muted-foreground">{r.schedule} · {!r.lastStatus ? 'not run yet' : isFailing(r) ? `failed ${ago(r.lastAt)}${r.lastError ? `: ${r.lastError}` : ''}` : `${r.lastStatus} ${ago(r.lastAt)}`}</span>
              </span>
              {r.name !== 'story-prompt' && <Button variant="outline" size="sm" onClick={() => run(r.name === 'daily-draft' ? 'draft' : r.name === 'intake' ? 'intake' : 'review')}>Run now</Button>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted-foreground">Emails come from the agent: the drafts each morning, one question each weekday evening, the voice report on Sundays.</p>
    </>
  );
}
