"""Every cited page on the map, with what the map draws from it.

Shared by tools/reread.py (the queue a person works through) and tools/links.py (the link check).
A page is keyed by its URL: one reading of a page covers every item that cites it.
"""
import glob, json, os, re
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
FILES = ['watch', 'offshoots', 'ideals', 'fruits', 'carriers', 'vehicles', 'edges', 'funders', 'labs', 'evaluators',
         'mechanisms', 'patterns', 'people', 'methods', 'texts', 'words']
TEXT_KEYS = ('quote', 'said', 'claim', 'what', 'sentence', 'evidence', 'title', 'label', 'summary', 'plain')
# Words the map presents as the source's own: a quotation field, a Watch claim, and anything in curly quotes
# inside the map's statements. These can be looked for on the page automatically (tools/precheck.py).
CURLY = re.compile(r'\u201c([^\u201d]+)\u201d')
STATEMENT_KEYS = ('what', 'sentence', 'evidence', 'claim')

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
    'does not hold': 'the page does not say what the map says: to be fixed, then marked corrected or removed',
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


def _quotes(fname, d, path, labels=frozenset()):
    out = []
    if isinstance(d.get('quote'), str) and d['quote'].strip():
        out.append(d['quote'].strip())
    if fname == 'watch' and isinstance(d.get('said'), str) and d['said'].strip():   # a step in how a claim travelled
        out.append(d['said'].strip())
    if fname == 'watch' and not path and isinstance(d.get('claim'), str):
        out.append(d['claim'].strip())
    for k in STATEMENT_KEYS:
        if isinstance(d.get(k), str) and not (fname == 'watch' and not path and k == 'claim'):
            # A name on the map in quotation marks (a pattern's label in a reading) is not the source's words.
            out += [q.strip() for q in CURLY.findall(d[k]) if len(q.split()) >= 3 and q.strip().lower() not in labels]
    return out


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
                                   'flag': o.get('verified') or 'none', 'tier': t, 'nolink': bool(o.get('nolink')),
                                   'quotes': _quotes(fname, o, path, labels)})
            for k, v in o.items():
                walk(v, fname, owner, path + [k], kind)
        elif isinstance(o, list):
            for i, v in enumerate(o):
                walk(v, fname, owner, path, kind)

    labels = set()
    for fname in FILES + ['texts']:
        fp = os.path.join(data_dir, fname + '.json')
        if os.path.exists(fp):
            labels.update(str(r.get('label', '')).strip().lower() for r in json.load(open(fp, encoding='utf-8')) if r.get('label'))
    for fname in FILES:
        fp = os.path.join(data_dir, fname + '.json')
        if not os.path.exists(fp):
            continue
        for i, rec in enumerate(json.load(open(fp, encoding='utf-8'))):
            owner = rec.get('id') or (f"{rec.get('from')} {rec.get('type')} {rec.get('to')}" if fname == 'edges' else str(i))
            walk(rec, fname, owner, [], None)
    return pages


INBOX = 'reread-inbox'
DONE_DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def ledger(data_dir=DATA, warn=None):
    """Every reading a person has recorded, one per page: data/reread.json (written by tools/reread.py and
    tools/review.py) and the files the phone page (site/reread.html) saves into data/reread-inbox/. The latest date
    wins; on the same day a reading with a time ("at") beats one without, and a later file beats an earlier one.
    A malformed file or row is skipped with a warning, never fatal: a reading saved from a phone must not stop a deploy."""
    say = warn or (lambda m: None)
    files = [os.path.join(data_dir, 'reread.json')] + sorted(glob.glob(os.path.join(data_dir, INBOX, '*.json')))
    best = {}
    for order, fp in enumerate(files):
        if not os.path.exists(fp):
            continue
        rel = os.path.relpath(fp, data_dir)
        try:
            rows = json.load(open(fp, encoding='utf-8'))
        except ValueError as e:
            say(f'{rel} is not readable JSON ({e}); skipped')
            continue
        for r in rows if isinstance(rows, list) else [rows]:
            if not (isinstance(r, dict) and isinstance(r.get('url'), str) and re.match(r'^https?://', r['url'])
                    and r.get('result') in RESULTS and DONE_DATE.match(str(r.get('date', '')))):
                say(f'{rel}: a malformed reading was skipped: {str(r)[:100]}')
                continue
            key = (r['date'], str(r.get('at') or ''), order)
            if r['url'] not in best or key >= best[r['url']][0]:
                best[r['url']] = (key, {k: v for k, v in r.items() if k in ('url', 'date', 'result', 'note', 'at')})
    return sorted((v[1] for v in best.values()), key=lambda r: (r['date'], r['url']))
