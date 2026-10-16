import { PreProcessor, env } from 'lua-cli';
import { OWNER } from '../knowledge/owner';

// The agent works for the owner only. Anyone else who reaches it gets a fixed line and their message never reaches the
// model, so nobody else can read the owner's material, his drafts or his sources.

const DEFAULT_OWNER_EMAILS = OWNER.email;

export default new PreProcessor({
  name: 'gatekeeper',
  description: `Lets ${OWNER.first} through; everyone else gets a fixed reply and never reaches the model`,
  priority: 1,
  execute: async (user: any, _messages: any[], _channel: string) => {
    const profile = user?._luaProfile ?? {};
    const ownerEmails = (env('OWNER_EMAILS') || DEFAULT_OWNER_EMAILS).toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
    const ownerIds = (env('OWNER_USER_IDS') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const emails: string[] = (profile.emailAddresses ?? []).map((e: string) => e.toLowerCase());
    const isOwner = ownerIds.includes(profile.userId) || emails.some((e) => ownerEmails.includes(e));
    if (isOwner) return { action: 'proceed' };
    return { action: 'block', response: `This is ${OWNER.name}'s LinkedIn writer and it works only for ${OWNER.first}. If you need ${OWNER.first}, email ${OWNER.email}.` };
  },
});
