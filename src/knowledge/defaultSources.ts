import type { Source } from '../lib/store';
import { OWNER } from './owner';

// The reading list the intake starts from. The owner adds and removes sources in chat or on the dashboard; these
// are only created when the sources collection is empty. A feed that fails shows its last status in the list, so a
// dead URL is visible rather than silently ignored.

type Seed = Omit<Source, 'active' | 'addedAt' | 'addedBy'>;

export const DEFAULT_SOURCES: Seed[] = [
  // AI, the builders' view (Substack and newsletters: the feed carries the full text of free posts)
  { name: 'One Useful Thing (Ethan Mollick)', kind: 'rss', url: 'https://www.oneusefulthing.org/feed', tags: ['ai', 'substack'] },
  { name: 'Import AI (Jack Clark)', kind: 'rss', url: 'https://importai.substack.com/feed', tags: ['ai', 'substack'] },
  { name: 'Latent Space', kind: 'rss', url: 'https://www.latent.space/feed', tags: ['ai', 'substack'] },
  { name: 'Exponential View (Azeem Azhar)', kind: 'rss', url: 'https://www.exponentialview.co/feed', tags: ['ai', 'substack'] },
  { name: 'Stratechery', kind: 'rss', url: 'https://stratechery.com/feed/', tags: ['strategy'] },
  { name: 'Simon Willison', kind: 'rss', url: 'https://simonwillison.net/atom/everything/', tags: ['ai', 'builders'] },
  { name: 'The Pragmatic Engineer', kind: 'rss', url: 'https://newsletter.pragmaticengineer.com/feed', tags: ['engineering', 'substack'] },
  { name: "Lenny's Newsletter", kind: 'rss', url: 'https://www.lennysnewsletter.com/feed', tags: ['product', 'substack'] },
  { name: 'Not Boring (Packy McCormick)', kind: 'rss', url: 'https://www.notboring.co/feed', tags: ['strategy', 'substack'] },
  { name: 'Hacker News front page (150+ points)', kind: 'rss', url: 'https://hnrss.org/frontpage?points=150', tags: ['tech'] },
  // AI news
  { name: 'TechCrunch AI', kind: 'rss', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', tags: ['ai', 'news'] },
  { name: 'The Verge AI', kind: 'rss', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', tags: ['ai', 'news'] },
  { name: 'MIT Technology Review', kind: 'rss', url: 'https://www.technologyreview.com/feed/', tags: ['ai', 'news'] },
  // The wider world
  { name: 'Rest of World', kind: 'rss', url: 'https://restofworld.org/feed/', tags: ['global-south', 'news'] },
  // Team Slack channels from owner.ts (a daily digest, what colleagues post, wins). Needs a Slack connection.
  ...OWNER.slackChannels.map((c) => ({ name: c.name, kind: 'slack' as const, channelId: c.channelId, tags: c.tags ?? ['slack'] })),
  // Newsletters that arrive by email in full (paid Substacks). Label them in Gmail with a filter. Needs a Gmail connection.
  { name: `Gmail label: ${OWNER.gmailLabel}`, kind: 'gmail-label', label: OWNER.gmailLabel, tags: ['newsletters', 'substack'] },
];
