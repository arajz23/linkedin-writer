import { env } from 'lua-cli';
import { z } from 'zod';
import { OWNER } from '../knowledge/owner';

// The platform does not always validate tool input against inputSchema before execute, so every tool parses here.
// Parsing also fills defaults.
export function parseInput<S extends z.ZodTypeAny>(schema: S, raw: unknown): z.infer<S> {
  const result = schema.safeParse(raw ?? {});
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
    throw new Error(`Invalid input: ${issues}`);
  }
  return result.data;
}

// Set LINKEDIN_DRY_RUN=1 (shell or .env) when testing workflows locally: steps that email the owner or write posts
// then skip the real effect. Never set in production.
export const isDryRun = () => /^(1|true|yes)$/i.test(String(env('LINKEDIN_DRY_RUN') ?? '').trim());

// QA runs tag their data "[QA]". Content like that must never reach the owner's inbox or the live voice profile.
export const isTestContent = (...texts: unknown[]) => texts.some((t) => typeof t === 'string' && /^\s*\[QA\]/i.test(t));

// A faked agent step (lua test workflow --agents fake) returns empty strings and zeros.
export const isBlank = (s: unknown) => typeof s !== 'string' || !s.trim();

// Why a side-effecting workflow step should skip, or null when it should go ahead.
export function skipReason(...content: unknown[]): string | null {
  if (isDryRun()) return 'dry run (LINKEDIN_DRY_RUN)';
  if (content.some(isBlank)) return 'empty content (faked agent step?)';
  if (isTestContent(...content)) return 'QA test content';
  return null;
}

// JSON of as many whole items as fit in maxChars, so a prompt never gets an item cut in half.
export function capJson(items: unknown[], maxChars: number) {
  const kept: unknown[] = [];
  let size = 2;
  for (const item of items) {
    const n = JSON.stringify(item).length + 1;
    if (size + n > maxChars) break;
    kept.push(item);
    size += n;
  }
  return JSON.stringify(kept);
}

export const todayLocal = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: OWNER.timezone });
export const weekdayLocal = (d = new Date()) => d.toLocaleDateString('en-GB', { timeZone: OWNER.timezone, weekday: 'long' });
