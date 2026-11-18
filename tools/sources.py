"""Every cited page on the map, with what the map draws from it.

Shared by tools/reread.py (the queue a person works through) and tools/links.py (the link check).
A page is keyed by its URL: one reading of a page covers every item that cites it.
"""
import json, os, re
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
FILES = ['watch', 'offshoots', 'ideals', 'fruits', 'carriers', 'vehicles', 'edges', 'funders', 'labs', 'evaluators',
         'mechanisms', 'patterns']
TEXT_KEYS = ('quote', 'claim', 'what', 'sentence', 'evidence', 'title', 'label', 'summary')

# Lower tier = read sooner. A page takes the most urgent tier of any item that cites it.
TIERS = {
    1: 'On the Watch: claims about named people and live events',
    2: 'Allegations and court matters',
    3: 'Not checked by any model',
    4: 'Checked by a model on a relay or coverage only',
    5: 'Checked by a model at the source',
}
RESULTS = {
    'holds': 'the page says what the map says',
    'corrected': 'the map was corrected to match the page',
    'removed': 'the item was taken off the map',
    'could not read': 'the page could not be read',
}
DONE = {'holds', 'corrected', 'removed'}


def host(url):
    h = (urlparse(url).hostname or '').lower()
    return h[4:] if h.startswith('www.') else h


def _text(d):
    for k in TEXT_KEYS:
        if isinstance(d.get(k), str) and d[k].strip():
            return d[k].strip()
    return ''


def _tier(fname, d, inherited_kind):
    if fname == 'watch':
        return 1
    if fname == 'offshoots' or d.get('kind') == 'alleged' or inherited_kind == 'alleged':
        return 2
    v = d.get('verified')
    if v in (None, '', 'unverified'):
        return 3
    return 4 if v == 'secondary' else 5


def collect(data_dir=DATA):
    """Return {url: {'tier', 'items': [...]}} for every http(s) URL in the data."""
    pages = {}

    def walk(o, fname, owner, path, kind):
        if isinstance(o, dict):
            kind = o.get('kind', kind) if isinstance(o.get('kind'), str) else kind
            url = o.get('url')
            if isinstance(url, str) and re.match(r'^https?://', url):
                t = _tier(fname, o, kind)
                p = pages.setdefault(url, {'tier': t, 'items': []})
                p['tier'] = min(p['tier'], t)
                p['items'].append({'file': fname, 'owner': owner, 'where': '.'.join(path) or 'record',
                                   'text': _text(o), 'source': o.get('source') or o.get('work') or o.get('title') or '',
                                   'flag': o.get('verified') or 'none', 'tier': t, 'nolink': bool(o.get('nolink'))})
            for k, v in o.items():
                walk(v, fname, owner, path + [k], kind)
        elif isinstance(o, list):
            for i, v in enumerate(o):
                walk(v, fname, owner, path, kind)

    for fname in FILES:
        fp = os.path.join(data_dir, fname + '.json')
        if not os.path.exists(fp):
            continue
        for i, rec in enumerate(json.load(open(fp, encoding='utf-8'))):
            owner = rec.get('id') or (f"{rec.get('from')} {rec.get('type')} {rec.get('to')}" if fname == 'edges' else str(i))
            walk(rec, fname, owner, [], None)
    return pages


def ledger(data_dir=DATA):
    fp = os.path.join(data_dir, 'reread.json')
    return json.load(open(fp, encoding='utf-8')) if os.path.exists(fp) else []
