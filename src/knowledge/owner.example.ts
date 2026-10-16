// Who this writer works for. Copy this file to owner.ts (git-ignored) and fill it in. Everything personal lives
// here and nowhere else: the persona, the prompts, the emails, the schedules and the dashboard all read from it.
//
//   cp src/knowledge/owner.example.ts src/knowledge/owner.ts
//
// The prompts refer to the owner as "he"; search and replace in src/ if that is wrong for you.

export const OWNER = {
  name: 'Alex Example', // full name, as on LinkedIn
  first: 'Alex', // how the writer addresses you
  email: 'alex@example.com', // where drafts, the daily question and the Sunday report go; only this address gets through in chat
  timezone: 'Europe/London', // every schedule runs in this timezone
  city: 'London', // used in prose, e.g. "06:30 London"

  // Two or three sentences the writer and the judge read before every post: what you do, where, and what you have
  // lived that nobody else on LinkedIn can say. Plain words.
  who: `Alex Example runs sales for an AI company in London. Alex has spent two years putting AI agents into real businesses and has seen what works after the demo, which is what Alex can say that nobody else on LinkedIn can.`,

  // Who should feel the post was written for them.
  audience: `Founders, operators and executives at mid-sized companies; AI builders who want to know what works outside the lab; people Alex wants to hire.`,

  // What makes a story relevant, for the intake scorer. One sentence.
  topics: `AI agents in real businesses, selling or running a company, hiring, and anything Alex has lived and others have not`,

  // The four pillars. Keep the keys (the weekday rotation uses them); the names and briefs are yours.
  pillars: [
    { key: 'take', name: 'AI news, my take', brief: 'One story from this week and what it means for a real business. A clear opinion, a concrete consequence, not a summary.' },
    { key: 'building', name: 'Building', brief: 'One thing we can now do, or one thing learned shipping it, explained to an operator with the real problem it solves. Never a feature list.' },
    { key: 'field', name: 'From the field', brief: 'A lesson from a client implementation, a deal or a demo. Anonymise the client unless the story is already public.' },
    { key: 'people', name: 'Personal', brief: "Saturday's slot, and the one only the owner can write: something built or decided first-hand (what it does, how it was built, what it took, what changed), views on the work, a lesson learned, a mistake. Built on the owner's own notes; never invented personal detail." },
  ] as const,

  // Hashtags the writer leans on, lower key. Three to five per post, usually two from here.
  hashtags: ['AI', 'Startups'],

  // Anything the writer must never write about (other people's accounts, a product that is not yours).
  offLimits: `Never write about other teams' accounts or products the owner does not work on.`,

  // Slack channels the intake reads (optional; the agent needs a Slack connection). Empty to skip.
  slackChannels: [] as { name: string; channelId: string; tags?: string[] }[],

  // Gmail label the intake reads newsletters from (optional; the agent needs a Gmail connection).
  gmailLabel: 'LinkedIn Reading',
};

export type Owner = typeof OWNER;
