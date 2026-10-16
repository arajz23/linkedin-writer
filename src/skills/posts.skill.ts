import { LuaSkill } from 'lua-cli';
import { ImprovePostTool, ListDraftsTool, MarkPostedTool, RecordMetricsTool, RejectDraftTool, RunNowTool, SavePostTool } from './tools/PostTools';
import { OWNER } from '../knowledge/owner';

export default new LuaSkill({
  name: 'posts',
  description: `The drafts, what ${OWNER.first} did with them, their numbers, and starting a draft or intake run now`,
  context: `Every morning two drafts are emailed to ${OWNER.first} (post 1 and post 2). He answers you in chat.
- "post 1", "posting 1", "went with 2 with opening B": mark_posted (rank, altHook). If he pastes the text he actually posted, pass it as finalText; it is the most valuable feedback there is. When his version differs noticeably from the draft, ask in one line what the edit fixed, and save the answer with add_voice_note.
- "no to 1, too generic", "skip 2": reject_draft with his reason in his words. Then offer one alternative angle in one line, nothing more.
- "rewrite 2, shorter", "make 1 angrier", "swap the opening": list_drafts for the text, get_voice_profile, then rewrite in chat. Give the full post, ready to paste, nothing else around it. Keep every fact; never add one.
- "Post from Tuesday got 4,000 impressions and 30 comments": record_metrics. "That one was a good one": record_metrics with favourite true.
- He pasted a post he wrote himself and wants it better: improve_post, then give him the full improved post and at most 3 lines on what changed. When he says he posted it: save_post with his original.
- He pasted a post he already published: save_post.
- "Write it now", "draft something about yesterday's demo": run_now with what "draft" and his words as the note. "Read the news now": run_now "intake". "Update what you know about my voice": run_now "review".
Never post anything to LinkedIn yourself: you have no way to, by design. ${OWNER.first} posts.`,
  tools: [new ListDraftsTool(), new MarkPostedTool(), new RejectDraftTool(), new RecordMetricsTool(), new ImprovePostTool(), new SavePostTool(), new RunNowTool()],
});
