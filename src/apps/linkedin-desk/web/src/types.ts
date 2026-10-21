// Shape of GET /summary and POST /improve (src/apps/linkedin-desk/app.ts).

export interface PostRow {
  id: string;
  date: string;
  rank?: number;
  status: 'draft' | 'posted' | 'rejected' | 'expired';
  pillar: string;
  topic: string;
  angle: string;
  hook: string;
  altHooks: string[];
  draft: string;
  hashtags: string[];
  visual?: string;
  check?: string;
  sources: string[];
  judge?: number;
  judgeNote?: string;
  finalText?: string;
  original?: string;
  editRatio?: number;
  postedAt?: string;
  postUrl?: string;
  rejectReason?: string;
  metrics?: { impressions?: number; reactions?: number; comments?: number; reposts?: number; engagements?: number; recordedAt: string };
  favourite?: boolean;
  origin: 'agent' | 'import' | 'owner';
}

export interface StoryRow { id: string; source: string; title: string; url: string; published?: string; score?: number; angleHint?: string; fromOwner?: boolean }
export interface SeedRow { id: string; kind: string; at: string; title?: string; text: string }
export interface SourceRow { id: string; name: string; kind: string; where?: string; lastRead?: string; lastStatus?: string; lastCount?: number }
export interface AutomationRow { name: string; label: string; schedule: string; lastStatus?: string; lastAt?: string | number; lastOkAt?: string | number; lastError?: string }

export interface Summary {
  generatedAt: string;
  owner: { first: string; name: string; timezone: string; city: string };
  pillars: Record<string, string>;
  today: string;
  draftsDate?: string;
  drafts: PostRow[];
  history: PostRow[];
  material: { stories: StoryRow[]; seeds: SeedRow[] };
  voice: {
    profile: { at: string; sampleSize: number; summary: string; rules: { rule: string; evidence: string; confidence: string }[]; hooksThatWork: string[]; hooksToAvoid: string[]; learnings: string[] } | null;
    notes: { at: string; note: string }[];
    proposals: { id: string; rule: string; why: string; kind: string; reviewDate: string }[];
  };
  sources: SourceRow[];
  automations: AutomationRow[];
}

export interface Improved { original: string; improved: string; hook: string; altHooks: string[]; changes: string[]; check?: string; lint: string[] }

export interface ReadPost { text: string; author?: string; date?: string; impressions?: number; reactions?: number; comments?: number; reposts?: number; confidence: 'high' | 'medium' | 'low'; note?: string }
export interface MetricRow { url?: string; date?: string; impressions?: number; reactions?: number; comments?: number; reposts?: number; engagements?: number }
