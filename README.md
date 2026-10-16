# LinkedIn writer

A personal LinkedIn ghostwriter that runs as an agent on [Lua](https://heylua.ai). It reads more than you have time
to, finds the angle, writes in your voice, and learns from what you do with every draft. Nothing is ever posted for
you: you post, and you tell it what happened.

Built for one person at a time. Everything personal lives in one file you keep out of git.

## What it does

| | When (your timezone) | What |
|---|---|---|
| Intake | 05:15, 11:15, 15:15, 20:15 daily | Reads every source (Substacks and blogs by feed, newsletters by Gmail label, Slack channels), scores each item 0 to 100 for "could this become a memorable post by you", files the good ones. |
| Morning drafts | 06:30 Mon to Sat | From the scored stories and your own notes: 6 to 8 angles, an independent judge ranks them, the best two are written in full, polished, linted, saved and emailed. Post 1 is the recommendation, with two alternative openings each. |
| One question | 17:30 weekdays | One specific question about your day, by email. Your two-line answer becomes material only you have. |
| Voice review | 16:00 Sundays | Rebuilds the voice profile from what you posted (and how you edited the draft), rejected (and why), said in chat, imported from your history, and the numbers you reported. Emails you what changed. |
| Dashboard | any time | "LinkedIn desk": today's drafts with Posted / I changed it / Not this one, a Write page that sharpens your own draft in your voice, a place for stories and links, your voice rules, past posts with their numbers, the reading list, and the chat docked beside it. |
| Chat | any time | "post 1", "post 2 with opening B", paste what you posted, "no to 1, too generic", "rewrite 2 shorter", "that one got 4,000 impressions", "never open with a question", "add this Substack", send a link, "make this better", "write it now". Only the owner gets through. |

The agent has no tool that can post or send to anyone but you, by design.

## How it learns

Every outcome is recorded by the chat tools and the dashboard, and read by the Sunday review:

- the draft you picked and the opening you chose;
- the text you actually posted, compared word by word with the draft;
- the draft you rejected and your reason;
- rules you state in passing ("fewer hashtags"), which apply from the next draft;
- impressions, reactions and comments you report, and posts you star (the writer imitates starred posts);
- your past posts, imported once from a LinkedIn export;
- your own drafts and what the Write page did to them.

The review writes a new `voice_profile` entry; the writer, the judge and the improver read the newest one on every run.

## Make it yours

You need Node 20+, [lua-cli](https://docs.heylua.ai) and a Lua account.

```bash
git clone https://github.com/arajz23/linkedin-writer
cd linkedin-writer
npm install
cp src/knowledge/owner.example.ts src/knowledge/owner.ts
```

Edit `src/knowledge/owner.ts`: your name, email, timezone, a few sentences on who you are and who you write for,
the four pillars, your hashtags. That file is git-ignored and is the only place anything personal lives.

Then create the agent and build the dashboard:

```bash
lua init --ci --agent-name "LinkedIn writer" --org-id <your-org-id> --model anthropic/claude-opus-5-5
cd src/apps/linkedin-desk/web && npm install && cd -
lua compile --ci
```

Try it before going live:

```bash
lua test --ci workflow --name intake --input '{"days":3}'
lua chat --ci -e sandbox -m "What do you read?" -t
lua apps dev linkedin-desk
```

Go live: `lua push all --ci --force`, `lua version create --ci -m "First version"`, promote the version, then deploy each
workflow (`lua workflows deploy <name> -v <version>`) and the persona (`lua persona production deploy --persona-version <n>`).
The dashboard opens at `https://workspace.heylua.ai/apps/<agent-id>/linkedin-desk`.

Optional connections, at agent scope: Gmail (so the intake reads the label where paid newsletters land) and Slack
(team channels listed in `owner.ts`). After connecting either, deactivate its integration MCP server
(`lua integrations mcp deactivate --connection <id>`): the code reads them, the model never gets send tools.

Import your past posts so the first review learns from your real voice (LinkedIn: Settings, Data privacy, Get a copy
of your data, Posts; the zip holds `Shares.csv`):

```bash
python3 scripts/import_linkedin_posts.py ~/Downloads/Shares.csv
```

## Where to change things

- Who you are, audience, pillars, hashtags, Slack channels, Gmail label: `src/knowledge/owner.ts`.
- The writing rules and the mechanical lint: `src/knowledge/voice.ts`.
- The starting reading list: `src/knowledge/defaultSources.ts` (used only when the `sources` collection is empty).
- Persona and hard rules: `src/index.ts`. Schedules: the `schedule` of each file in `src/workflows/`.
- Models: the agent runs on Opus 5.5 (angles, writing, review, improving); the judge is Sonnet 5.5; intake scoring is Haiku 5.5.

## Collections

`sources`, `stories`, `seeds`, `posts`, `voice_profile`, `voice_notes`, `story_prompts`. Shapes are in `src/lib/store.ts`.

## Limits worth knowing

LinkedIn's API gives no analytics for personal posts, so the numbers come from you (the Posts page or chat). It also
gives no read access to other people's posts; send the writer a link instead.
