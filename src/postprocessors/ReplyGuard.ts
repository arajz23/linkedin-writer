import { PostProcessor } from 'lua-cli';

// Mechanical clean-up of every reply to the owner: em dashes become commas or colons (the one rule the model breaks most),
// a sentence glued to the previous one after a tool call gets its space back, and a reply cut off mid-sentence says so.

export default new PostProcessor({
  name: 'reply-guard',
  description: 'No em dashes, no glued sentences, flags cut-off replies',
  priority: 50,
  async execute(_user, _message, response) {
    if (typeof response !== 'string' || !response.trim()) return { modifiedResponse: response };
    let text = response
      .replace(/\s+—\s+/g, ', ')
      .replace(/—/g, ', ')
      .replace(/\s+–\s+/g, ', ')
      .replace(/([a-z\)])([.!?])([A-Z][a-z'])/g, '$1$2 $3');
    const last = text.trimEnd().split('\n').pop() ?? '';
    if (/[a-z,]$/i.test(last) && last.split(' ').length > 6 && !/^[-*•\d#]/.test(last.trim())) {
      text = `${text.trimEnd()}…\n\n(My reply got cut off. Say "go on" and I'll finish it.)`;
    }
    return { modifiedResponse: text };
  },
});
