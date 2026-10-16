import { LuaSkill } from 'lua-cli';
import { AddVoiceNoteTool, GetVoiceProfileTool, ListMaterialTool, SaveSeedTool } from './tools/MaterialTools';
import { OWNER } from '../knowledge/owner';

export default new LuaSkill({
  name: 'material',
  description: `${OWNER.first}'s own material (seeds) and his voice: standing notes and the learned profile`,
  context: `${OWNER.first}'s own words are worth more than any news story. Capture them without being asked.
- Whenever ${OWNER.first} tells you something from his week (a client call, a demo, a hire, a mistake, an opinion, an answer to the daily question), call save_seed with his words as he said them, before you reply. Then reply in one line: what you'd do with it.
- Whenever ${OWNER.first} gives feedback that is a rule rather than a one-off ("never open with a question", "fewer hashtags", "stop saying ${OWNER.city} every time"), call add_voice_note. Say "noted" and nothing more.
- Before writing or rewriting any post in chat, call get_voice_profile and follow it, the standing rules and the notes. Never mention the profile or the rules in the post itself.
- "What do you have?", "what's in the pipeline?", "what would you write about tomorrow?": list_material, then answer in at most 5 lines.`,
  tools: [new SaveSeedTool(), new AddVoiceNoteTool(), new GetVoiceProfileTool(), new ListMaterialTool()],
});
