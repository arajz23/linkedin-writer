"""Shared helpers for the local scripts: project paths, the Lua API key and the agent id."""
import json, os, re, sys, urllib.error, urllib.request

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = 'https://api.heylua.ai'


def api_key():
    if os.environ.get('LUA_API_KEY'):
        return os.environ['LUA_API_KEY'].strip()
    env = os.path.join(PROJECT, '.env')
    if os.path.exists(env):
        for line in open(env):
            if line.startswith('LUA_API_KEY='):
                return line.split('=', 1)[1].strip().strip('"\'')
    cred = os.path.expanduser('~/.lua-cli/credentials')
    if os.path.exists(cred):
        return open(cred).read().strip()
    sys.exit('No Lua credential found: set LUA_API_KEY or run `lua auth configure`.')


def agent_id():
    for line in open(os.path.join(PROJECT, 'lua.skill.yaml')):
        m = re.match(r'\s*agentId:\s*(\S+)', line)
        if m:
            return m.group(1)
    sys.exit('No agentId in lua.skill.yaml: run `lua init` first.')


def request(method, path, key, body=None):
    req = urllib.request.Request(API + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        if method == 'DELETE' and e.code == 404:
            return {}
        raise RuntimeError(f'{method} {path} -> {e.code} {e.read()[:300]!r}')
