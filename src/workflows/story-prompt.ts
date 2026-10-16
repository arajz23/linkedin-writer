import { z } from 'zod';
import { createStep, createWorkflow, Data, AI, Channels } from 'lua-cli';
import { capJson, isDryRun, todayLocal } from '../lib/guards';
import { PROMPTS, allEntries, isoDaysAgo, topStories, unusedSeeds } from '../lib/store';
import { PILLARS, WHO } from '../knowledge/voice';
import { OWNER } from '../knowledge/owner';

// Weekdays 17:30 local time: one question to the owner, by email, that a two-line answer in chat turns into tomorrow's
// best material. The questions the news cannot answer: what he saw, sold, decided or got wrong today.

const OWNER_EMAIL = OWNER.email;

const ask = createStep({
  id: 'ask',
  inputSchema: z.object({}).passthrough(),
  outputSchema: z.object({ question: z.string(), sent: z.boolean() }),
  sideEffects: 'external',
  timeoutSeconds: 120,
  async execute(ctx) {
    const [asked, stories, seeds] = await Promise.all([
      allEntries<{ question: string; at: string }>(PROMPTS, { at: { $gte: isoDaysAgo(30) } }, 60), topStories(3, 60, 5), unusedSeeds(6),
    ]);
    const res: any = await AI.generate({
      model: 'anthropic/claude-sonnet-5-5',
      system: `You write one question a day for ${OWNER.name}, who answers in two lines so his LinkedIn writer has material only he has. ${WHO}
Pillars: ${PILLARS.map((p) => p.name).join(', ')}.
Ask about something specific he likely lived today or this week: a demo, a client call, a hire, a decision, a thing that broke, a number he saw, an argument he had, what surprised him. Never generic ("what did you learn today?"). Never ask for confidential detail by name; ask for the lesson, he decides what to share. One sentence, under 30 words, plain words, no em dashes. Avoid the questions already asked.`,
      prompt: `Questions asked in the last 30 days: ${JSON.stringify(asked.map((a) => a.data.question))}
Material he has already given (don't ask for what he said): ${capJson(seeds.map((s) => s.data.text.slice(0, 200)), 2000)}
Top stories this week, in case one deserves his first-hand view: ${capJson(stories.map((s) => ({ title: s.data.title, hint: s.data.angleHint })), 2000)}
Answer with the question only.`,
      temperature: 0.8,
      maxOutputTokens: 120,
    });
    const question = String(res?.text ?? '').replace(/^["\s]+|["\s]+$/g, '').replace(/—/g, ',').slice(0, 300);
    if (!question || isDryRun()) { ctx.log?.(`not sent: ${question ? 'dry run' : 'no question'}`); return { question, sent: false }; }
    const at = new Date().toISOString();
    await ctx.once('record', () => Data.create(PROMPTS, { question, at, date: todayLocal() }, question));
    await ctx.once('send', () => Channels.email.send({
      to: { email: OWNER_EMAIL },
      subject: `LinkedIn · one question · ${todayLocal()}`,
      richBody: `${question}\n\nTwo lines back in chat is enough. Whatever you say becomes material for tomorrow's draft, in your words.`,
    }));
    return { question, sent: true };
  },
});

export const storyPrompt = createWorkflow({
  name: 'story-prompt',
  description: `Weekdays 17:30 ${OWNER.city}: one specific question to ${OWNER.first} by email; his answer in chat becomes material for the next draft.`,
  inputSchema: z.object({}).passthrough(),
  schedule: { type: 'cron', expression: '30 17 * * 1-5', timezone: OWNER.timezone },
  scheduleInput: {},
  concurrencyPolicy: 'forbid',
  budget: { maxDurationSeconds: 300 },
})
  .then(ask)
  .commit();
