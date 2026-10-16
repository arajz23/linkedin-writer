#!/usr/bin/env python3
"""Load your past LinkedIn posts (Shares.csv from a LinkedIn data export) into the agent's `posts` collection,
so the Sunday voice review learns from what you actually wrote and the writer has real exemplars.

LinkedIn: Settings -> Data privacy -> Get a copy of your data -> tick "Posts" (or the full archive) -> the zip holds
Shares.csv with columns Date, ShareLink, ShareCommentary, SharedUrl, MediaUrl, Visibility.

Re-runnable: posts are keyed by ShareLink, so a newer export only uploads new rows.

Usage:
  python3 scripts/import_linkedin_posts.py ~/Downloads/Shares.csv
  python3 scripts/import_linkedin_posts.py ~/Downloads/Shares.csv --dry-run
  python3 scripts/import_linkedin_posts.py ~/Downloads/Shares.csv --min-words 25
"""
import argparse, csv, io, json, os, re, sys, time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lua_api import PROJECT, api_key, agent_id, request  # noqa: E402

COLLECTION = 'posts'
STATE_FILE = os.path.join(PROJECT, 'scripts', '.import-state.json')


def call(*args, **kw):
    for attempt in range(5):
        try:
            return request(*args, **kw)
        except Exception as e:  # noqa: BLE001
            if attempt == 4:
                raise
            print(f'  retrying after: {str(e)[:80]}', flush=True)
            time.sleep(2 * (attempt + 1))


def rows(path, min_words):
    text = open(path, encoding='utf-8-sig', errors='ignore').read()
    start = text.find('Date,')
    if start < 0:
        sys.exit('No "Date," header found; is this a LinkedIn Shares.csv?')
    for r in csv.DictReader(io.StringIO(text[start:])):
        body = (r.get('ShareCommentary') or '').strip()
        link = (r.get('ShareLink') or '').strip()
        if not body or not link or len(body.split()) < min_words:
            continue  # reposts without commentary and one-liners teach nothing about voice
        raw_date = (r.get('Date') or '').strip()
        try:
            date = datetime.strptime(raw_date[:19], '%Y-%m-%d %H:%M:%S')
        except ValueError:
            date = datetime.utcnow()
        hook = body.split('\n')[0][:160]
        yield link, {
            'at': date.isoformat() + 'Z',
            'date': date.strftime('%Y-%m-%d'),
            'status': 'posted',
            'pillar': 'unknown',
            'topic': re.sub(r'\s+', ' ', hook)[:80],
            'angle': '',
            'hook': hook,
            'altHooks': [],
            'draft': body,
            'finalText': body,
            'hashtags': [h[1:] for h in re.findall(r'#\w+', body)],
            'sources': [(r.get('SharedUrl') or '').strip()] if (r.get('SharedUrl') or '').strip() else [],
            'postedAt': date.isoformat() + 'Z',
            'postUrl': link,
            'editRatio': 0,
            'origin': 'import',
        }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('csv')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--min-words', type=int, default=20)
    args = ap.parse_args()

    state = json.load(open(STATE_FILE)) if os.path.exists(STATE_FILE) else {}
    posts = dict(rows(args.csv, args.min_words))
    print(f'{len(posts)} posts with {args.min_words}+ words in the export, {len([k for k in posts if k in state])} already imported')
    if args.dry_run:
        for link, p in list(posts.items())[:5]:
            print(f'  {p["date"]}  {p["hook"][:70]}')
        return
    key, aid = api_key(), agent_id()
    added = 0
    for link, p in posts.items():
        if link in state:
            continue
        search = f'{p["date"]} {p["hook"]} {p["draft"][:1500]}'
        res = call('POST', f'/developer/agents/{aid}/custom-data/{COLLECTION}', key, {'data': p, 'searchText': search})
        state[link] = {'id': res.get('id') or res.get('data', {}).get('id'), 'date': p['date']}
        added += 1
        json.dump(state, open(STATE_FILE, 'w'), indent=1)
        print(f'  + {p["date"]}  {p["hook"][:70]}', flush=True)
    print(f'done: {added} added. Run the Sunday review now with: lua chat --ci -e production -m "update what you know about my voice"')


if __name__ == '__main__':
    main()
