#!/usr/bin/env python3
"""Ideals Map: validate the data files and build the site data and a standalone preview.

  python3 build.py                 data/ -> site/graph.json and dist/ideals-map.html
  python3 build.py --data DIR      use another data directory (e.g. test/fixture)
  python3 build.py --check         validate only, write nothing

The validator is the guardrail: it fails the build on a broken link, an unknown type or
status, a missing source, a quotation that is too long, or a label that calls a group a
cult. It cannot check that a claim is true. That is what the `verified` flag is for.
"""
import argparse, json, os, re, subprocess, sys
import glob
from urllib.parse import urlparse


def host_of(url):
    h = (urlparse(str(url)).hostname or '').lower()
    return h[4:] if h.startswith('www.') else h


HERE = os.path.dirname(os.path.abspath(__file__))
NODE_FILES = ['ideals', 'carriers', 'vehicles', 'fruits', 'texts', 'funders', 'labs', 'evaluators', 'patterns', 'mechanisms', 'offshoots']
OPTIONAL_FILES = {'funders', 'labs', 'evaluators'}
ANCIENT_FILES = {'patterns', 'mechanisms', 'offshoots'}
OFFSHOOT_STATUS = {'charged', 'pending', 'decided', 'unknown', 'historical'}
NOT_LINKED = re.compile(r'\bnot linked\b(?! to)|do not link|never link', re.I)
EDGE_TYPES = {'carries', 'descends_from', 'runs_on', 'bears_fruit', 'fed_by', 'starved_by',
              'speaks_for', 'captures', 'parallels', 'opposes', 'resembles',
              'funds', 'evaluates', 'hosts', 'invokes', 'reads_as', 'uses', 'breaks_from'}
# What kind of money a funds link is: a stake or loan, a gift, public money, paid work, political spending, or a
# purchase of goods or services (compute, leases), which is money paid but not funding.
MONEY_KINDS = {'investment', 'grant', 'government', 'commission', 'political', 'purchase'}
# The ancient layer: who may stand at each end of a link.
ANCIENT_ENDS = {
    'invokes': ({'carriers', 'vehicles', 'ideals', 'funders', 'labs'}, {'patterns'}),
    'reads_as': ({'ideals', 'mechanisms', 'carriers', 'vehicles', 'offshoots'}, {'patterns'}),
    'uses': ({'carriers', 'vehicles', 'ideals', 'offshoots', 'funders', 'labs'}, {'mechanisms'}),
    'breaks_from': ({'offshoots'}, {'carriers', 'ideals', 'vehicles'}),
}
SENSE = {'sincere', 'ironic', 'metaphor', 'unclear'}
MAX_SOURCE = 220
# The money layer: who may stand at each end of a link.
MONEY_ENDS = {
    'funds': ({'funders', 'labs', 'carriers', 'evaluators'}, {'carriers', 'vehicles', 'evaluators', 'labs', 'funders'}),
    'evaluates': ({'evaluators'}, {'labs', 'vehicles'}),
    'hosts': ({'carriers', 'funders', 'labs', 'evaluators'}, {'carriers', 'evaluators', 'funders', 'labs', 'fruits', 'vehicles'}),
}
FUNDER_KIND = {'person', 'individuals', 'foundation', 'fund', 'firm', 'company', 'government', 'nonprofit', 'political committee'}
DATE = re.compile(r'^\d{4}(-\d{2}(-\d{2})?)?$')
STATUS = {'met', 'partly', 'not_met', 'unknown'}
VERIFIED = {'primary', 'secondary', 'unverified'}
REREAD_RESULTS = {'holds', 'corrected', 'removed', 'does not hold', 'could not read'}
PEOPLE_GROUPS = {'builders', 'thinkers', 'faith', 'press', 'officials', 'past'}
METHOD_KEY = ['serves', 'values', 'inside', 'checks', 'fails']
DOOR_VIEWS = {'ideals', 'methods', 'money', 'ancients', 'timeline', 'watch', 'people', 'words', 'start', 'heart'}
MAX_WHO = 240
FRUIT_KIND = {'documented', 'reported', 'alleged'}
CARRIER_KIND = {'movement', 'organization', 'community', 'public figure', 'discourse', 'product', 'venue'}
REQUIRED = {
    'ideals': ['id', 'label', 'ideal'],
    'carriers': ['id', 'label', 'kind', 'status'],
    'vehicles': ['id', 'label'],
    'fruits': ['id', 'date', 'label', 'what', 'kind', 'source', 'url', 'verified'],
    'texts': ['id', 'ref', 'quote'],
    'funders': ['id', 'label', 'kind'],
    'labs': ['id', 'label'],
    'evaluators': ['id', 'label'],
    'patterns': ['id', 'label', 'summary'],
    'mechanisms': ['id', 'label', 'definition'],
    'offshoots': ['id', 'label', 'status', 'why_not'],
}
MAX_QUOTE = 160
URL = re.compile(r'^https?://[^\s]+$')
ID = re.compile(r'^[a-z0-9][a-z0-9-]*$')
# Guardrail 1 of the spec: movements are described, not labelled. Source titles are exempt.
LABEL_BAN = re.compile(r'\b(cult|cults|cultists?|brainwash\w*|idolaters?|possessed|demonic|heretics?|heretical|deluded|delusional|'
                       r'satanic|false prophets?)\b', re.I)
# Working notes that must not reach a reader: research ids, file paths, instructions to curators.
INTERNAL = re.compile(r'\b(primary-s\d+|invoked-i\d+|mechanisms-[a-z-]+-[sx]\d+|map flag|do not link|name it, never|'
                      r'string-check|research record|map quotation|not yet in the corpus|in this pass|alt URL|not opened here|'
                      r'Describe, never prescribe|fetch tool|returned 403|dossiers?|per the checker)\b|(?-i:\bTODO\b)|(?-i:\bEXP-[A-Z]+)|\(Adapted\.\)|\.json\b|\bops/(ideals-map|lab)/|'
                      r'/data/[a-z]', re.I)
RELAYED = re.compile(r'\b(as quoted|quoted by|quoted in|as reported|reported by|in a release by|relayed? (by|on|through)|via(?! X\b))\b', re.I)
# A page the speaker did not publish: an interview, a transcript, an encyclopedia.
NOT_OWN = re.compile(r'\binterview (by|with)\b|\btranscript\b|\bas told to\b', re.I)
# Historians' terms for the ancient world, which pattern text may use.
ANCIENT_TERMS = re.compile(r'\b(imperial cult|cult statues?|cult image|ruler cult|the cult is attested|False Prophet)\b', re.I)
# A word inside quotation marks is a mention (someone else's word), not a label.
QUOTED = re.compile(r'\u201c[^\u201d]*\u201d|"[^"]*"|\u2018[^\u2019]*\u2019')
# The money layer states flows and stops. These words assert a motive or a verdict.
MOTIVE_BAN = re.compile(r'\b(brib\w*|bought|buys|buying|buy off|paid off|pay off|pays off|paying off|pay-?offs?|in the pockets?|fronts? for|fronting for|shill\w*|'
                        r'launder\w*|captur(?:e|es|ed|ing)|puppet\w*|corrupt\w*|compromis(?:e|es|ed|ing)|astroturf\w*|hush[ -]money|kickbacks?|quid pro quo|beholden)\b', re.I)


def load(data_dir):
    g = {}
    for name in NODE_FILES + ['edges', 'phases']:
        path = os.path.join(data_dir, name + '.json')
        if (name in OPTIONAL_FILES or name in ANCIENT_FILES) and not os.path.exists(path):
            g[name] = []
            continue
        with open(path, encoding='utf-8') as fh:
            g[name] = json.load(fh)
    # The Watch: claims in circulation and what has been checked (optional).
    wpath = os.path.join(data_dir, 'watch.json')
    g['watch'] = json.load(open(wpath, encoding='utf-8')) if os.path.exists(wpath) else []
    meta = os.path.join(data_dir, 'meta.json')
    g['meta'] = json.load(open(meta, encoding='utf-8')) if os.path.exists(meta) else {}
    # Pages a person has re-read: data/reread.json and the phone page's data/reread-inbox/ (tools/sources.py merges
    # them, one reading per page). A reading of a page the map no longer cites is dropped with a warning.
    sys.path.insert(0, os.path.join(HERE, 'tools'))
    import sources
    g['reread'] = sources.ledger(data_dir, warn=lambda m: print('warning:', m))
    # Who's who: one plain line on each public figure the map names (optional).
    ppath = os.path.join(data_dir, 'people.json')
    g['people'] = json.load(open(ppath, encoding='utf-8')) if os.path.exists(ppath) else []
    # Words you'll meet: a plain meaning for each term a reader may not know, linked to the record that goes deeper.
    wpath = os.path.join(data_dir, 'words.json')
    g['words'] = json.load(open(wpath, encoding='utf-8')) if os.path.exists(wpath) else []
    # Alignment methods, each with the same five questions answered; and the doors, ways in by viewpoint (optional).
    for name in ('methods', 'doors'):
        fp = os.path.join(data_dir, name + '.json')
        g[name] = json.load(open(fp, encoding='utf-8')) if os.path.exists(fp) else []
    return g


def cited_urls(g):
    """Every http(s) URL the data cites, anywhere."""
    found = set()

    def walk(o):
        if isinstance(o, dict):
            if isinstance(o.get('url'), str) and URL.match(o['url']):
                found.add(o['url'])
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    for k, v in g.items():
        if k not in ('reread', 'meta', 'phases', 'doors'):
            walk(v)
    return found


def validate(g):
    # A carrier's own sales or recruitment site is named and never linked (guardrail 4).
    NOLINK_HOSTS = set((g.get('meta') or {}).get('nolink_hosts', []))
    errs, ids = [], {}

    def err(msg):
        errs.append(msg)

    owner_words = {}

    def check_words(owner, words):
        for w in words or []:
            for k in ('speaker', 'quote', 'source', 'url', 'verified'):
                if not w.get(k):
                    err(f'{owner}: a quotation is missing "{k}"')
            if len(w.get('quote', '')) > MAX_QUOTE:
                err(f'{owner}: quotation over {MAX_QUOTE} characters: {w["quote"][:40]}...')
            if w.get('url') and not URL.match(w['url']):
                err(f'{owner}: bad url {w["url"]}')
            if w.get('verified') not in VERIFIED:
                err(f'{owner}: verified must be one of {sorted(VERIFIED)}')
            if w.get('verified') == 'primary' and RELAYED.search(str(w.get('speaker', ''))):
                err(f'{owner}: words its speaker label says were quoted or reported cannot be primary: {w["quote"][:40]}')
            if w.get('verified') == 'primary' and (NOT_OWN.search(str(w.get('source', ''))) or 'wikipedia.org' in str(w.get('url', ''))):
                err(f'{owner}: words read in an interview, a transcript or an encyclopedia cannot be primary: {w["quote"][:40]}')
            seen_w = (w.get('speaker'), w.get('quote'))
            if seen_w in owner_words.setdefault(owner, set()):
                err(f'{owner}: the same words twice: {w["quote"][:40]}')
            owner_words[owner].add(seen_w)

    for name in NODE_FILES:
        for n in g[name]:
            nid = n.get('id', '?')
            for k in REQUIRED[name]:
                if n.get(k) in (None, ''):
                    err(f'{name}/{nid}: missing "{k}"')
            if not ID.match(str(nid)):
                err(f'{name}/{nid}: id must be lower-case letters, digits and hyphens')
            if nid in ('money', 'ancients', 'drawing'):
                err(f'{name}/{nid}: "{nid}" is the address of a view (#{nid}); use another id')
            if nid in ids:
                err(f'{name}/{nid}: duplicate id (also in {ids[nid]})')
            ids[nid] = name
            for field in ('label', 'ideal', 'summary', 'note', 'what', 'status'):
                if LABEL_BAN.search(QUOTED.sub('', str(n.get(field, '')))):
                    err(f'{name}/{nid}: "{field}" labels a group (guardrail 1): {n[field][:60]}')
            check_words(f'{name}/{nid}', n.get('words'))
            # The card's quotation: an index into the ideal's own words (default the first).
            if 'lead' in n and not (isinstance(n['lead'], int) and 0 <= n['lead'] < len(n.get('words') or [])):
                err(f'{name}/{nid}: "lead" must be the index of one of its quotations')
            for x in n.get('field_key') or []:
                if LABEL_BAN.search(QUOTED.sub('', str(x.get('a', '')))) or INTERNAL.search(str(x.get('a', ''))):
                    err(f'{name}/{nid}: a field-key answer labels a party or leaks a working note: {str(x.get("a"))[:60]}')
            if name in ANCIENT_FILES:
                for field in ('summary', 'definition', 'why_not', 'note'):
                    if MOTIVE_BAN.search(QUOTED.sub('', str(n.get(field, '')))) and name == 'offshoots':
                        err(f'{name}/{nid}: "{field}" asserts a motive or a verdict')
                reader = [n.get(f, '') for f in ('summary', 'definition', 'why_not', 'note', 'status')] + list(n.get('cautions') or []) + \
                    [c.get('text', '') for c in n.get('counter') or []] + [c.get('ref', '') for c in n.get('counter') or []] + \
                    [x.get(k, '') for x in (n.get('sources') or []) for k in ('passage', 'translation', 'says')] + \
                    [x.get(k, '') for x in (n.get('record') or []) + (n.get('pushback') or []) for k in ('what', 'sentence', 'source')] + \
                    [x.get('claim', '') for x in n.get('scholarship') or []]
                for text in reader:
                    # Patterns describe the ancient world in its historians' terms (a cult statue, the imperial cult),
                    # which are allowed there; any other label is refused in every node type.
                    plain = QUOTED.sub('', str(text))
                    if name == 'patterns':
                        plain = ANCIENT_TERMS.sub('', plain)
                    if LABEL_BAN.search(plain):
                        err(f'{name}/{nid}: labels a party in the map\'s own voice (spec section 9): {str(text)[:60]}')
                    if INTERNAL.search(str(text)):
                        err(f'{name}/{nid}: a working note reaches the reader: {str(text)[:70]}')
                for c in n.get('counter') or []:
                    if not (c.get('ref') and c.get('text')):
                        err(f'{name}/{nid}: a counter-reading needs "ref" and "text"')
                for x in n.get('scholarship') or []:
                    if (x.get('url') and not URL.match(x['url'])) or (x.get('verified') and x['verified'] not in VERIFIED):
                        err(f'{name}/{nid}: a scholarship entry has a bad url or verified flag')
                    if x.get('verified') == 'primary' and (re.search(r'wikipedia\.org|scientificamerican\.com', x.get('url', '')) or
                                                           re.search(r'relayed by|Read via|A relay only|Read only through|was not opened', x.get('claim', ''))):
                        err(f'{name}/{nid}: scholarship read on a relay cannot be primary: {x.get("title", "")[:40]}')
                for s in n.get('sources') or []:
                    for k in ('tradition', 'work', 'quote', 'url', 'verified'):
                        if not s.get(k):
                            err(f'{name}/{nid}: an ancient source is missing "{k}"')
                    if len(s.get('quote', '')) > MAX_SOURCE:
                        err(f'{name}/{nid}: ancient source quotation over {MAX_SOURCE} characters')
                    if s.get('verified') not in VERIFIED or (s.get('url') and not URL.match(s['url'])):
                        err(f'{name}/{nid}: an ancient source has a bad url or verified flag')
                for t in n.get('texts') or []:
                    if t not in {x['id'] for x in g['texts']}:
                        err(f'{name}/{nid}: text {t} is not in texts.json')
                for r in n.get('record') or []:
                    for k in ('date', 'what', 'kind', 'source', 'url', 'verified'):
                        if not r.get(k):
                            err(f'{name}/{nid}: a record entry is missing "{k}"')
                    if r.get('kind') not in FRUIT_KIND or r.get('verified') not in VERIFIED or not DATE.match(str(r.get('date', ''))):
                        err(f'{name}/{nid}: a record entry has a bad kind, flag or date')
                    if LABEL_BAN.search(QUOTED.sub('', str(r.get('what', '')))):
                        err(f'{name}/{nid}: a record entry labels a group (guardrail 1)')
                    if name == 'offshoots' and r.get('status') not in OFFSHOOT_STATUS:
                        err(f'{name}/{nid}: a record entry needs a status, one of {sorted(OFFSHOOT_STATUS)}')
                for s in n.get('scholarship') or []:
                    if not (s.get('author') and s.get('title') and s.get('year')):
                        err(f'{name}/{nid}: scholarship needs author, title and year')
                for s in n.get('pushback') or []:
                    for k in ('sentence', 'source', 'url', 'verified'):
                        if not s.get(k):
                            err(f'{name}/{nid}: a pushback entry is missing "{k}"')
                    if s.get('verified') not in VERIFIED or (s.get('url') and not URL.match(s['url'])):
                        err(f'{name}/{nid}: a pushback entry has a bad url or verified flag')
            if name in OPTIONAL_FILES:
                if MOTIVE_BAN.search(QUOTED.sub('', str(n.get('note', '')))):
                    err(f'{name}/{nid}: "note" asserts a motive or a verdict; state the record and stop')
                if n.get('policy'):
                    check_words(f'{name}/{nid} policy', [n['policy']])
                for d in n.get('disputes') or []:
                    for k in ('date', 'what', 'kind', 'source', 'url', 'verified'):
                        if not d.get(k):
                            err(f'{name}/{nid}: a dispute is missing "{k}"')
                    if d.get('kind') not in FRUIT_KIND or d.get('verified') not in VERIFIED:
                        err(f'{name}/{nid}: a dispute has a bad kind or verified flag')
                    if d.get('url') and not URL.match(d['url']):
                        err(f'{name}/{nid}: a dispute has a bad url')
                    if d.get('date') and not DATE.match(str(d['date'])):
                        err(f'{name}/{nid}: a dispute date must be YYYY, YYYY-MM or YYYY-MM-DD')
                    if LABEL_BAN.search(QUOTED.sub('', str(d.get('what', '')) + ' ' + str(d.get('response', '')))):
                        err(f'{name}/{nid}: a dispute labels a group (guardrail 1)')
                    if MOTIVE_BAN.search(QUOTED.sub('', str(d.get('what', '')) + ' ' + str(d.get('response', '')))):
                        err(f'{name}/{nid}: a dispute asserts a motive or a verdict; report who said what and stop')
    for f in g['funders']:
        if f.get('kind') not in FUNDER_KIND:
            err(f'funders/{f.get("id")}: kind must be one of {sorted(FUNDER_KIND)}')

    for d in g['ideals']:
        fk = d.get('field_key')
        if fk is not None and (len(fk) != 5 or not all(x.get('q') and x.get('a') for x in fk)):
            err(f'ideals/{d.get("id")}: field_key needs the five questions, each with an answer')
        said = list(d.get('cautions') or []) + [c.get(k, '') for p in d.get('phases', [])
                                                for c in p.get('conditions', []) for k in ('text', 'evidence')]
        for s in said:
            if LABEL_BAN.search(QUOTED.sub('', str(s))):
                err(f'ideals/{d.get("id")}: labels a group (guardrail 1): {str(s)[:60]}')
        for entry in d.get('phases', []):
            if [x.get('phase') for x in d['phases']].count(entry.get('phase')) > 1:
                err(f'ideals/{d["id"]}: phase {entry.get("phase")} is listed twice; the viewer shows only the first entry')
            if type(entry.get('phase')) is not int or entry.get('phase') not in range(6):
                err(f'ideals/{d["id"]}: phase must be 0-5')
            for c in entry.get('conditions', []):
                if not c.get('text'):
                    err(f'ideals/{d["id"]}: a condition has no text')
                if c.get('status') not in STATUS:
                    err(f'ideals/{d["id"]}: condition status must be one of {sorted(STATUS)}')
                if c.get('status') in ('met', 'partly') and not c.get('evidence'):
                    err(f'ideals/{d["id"]}: a met or partly met condition needs evidence: {c.get("text", "")[:50]}')
                if c.get('url') and not URL.match(c['url']):
                    err(f'ideals/{d["id"]}: bad condition url {c["url"]}')
    for c in g['carriers']:
        if c.get('kind') not in CARRIER_KIND:
            err(f'carriers/{c.get("id")}: kind must be one of {sorted(CARRIER_KIND)}')
    for f in g['fruits']:
        if f.get('kind') not in FRUIT_KIND:
            err(f'fruits/{f.get("id")}: kind must be one of {sorted(FRUIT_KIND)}')
        if f.get('verified') not in VERIFIED:
            err(f'fruits/{f.get("id")}: verified must be one of {sorted(VERIFIED)}')
        if f.get('url') and not URL.match(f['url']):
            err(f'fruits/{f.get("id")}: bad url')
        if not DATE.match(str(f.get('date', ''))):
            err(f'fruits/{f.get("id")}: date must be YYYY, YYYY-MM or YYYY-MM-DD')
    for t in g['texts']:
        if len(t.get('quote', '')) > MAX_QUOTE:
            err(f'texts/{t.get("id")}: quotation over {MAX_QUOTE} characters')

    linked, money = set(), 0
    seen_edges = set()

    # A carrier's own sales or recruitment site is named and never linked, wherever a link appears (guardrail 4).
    def walk(x, where):
        if isinstance(x, dict):
            if x.get('url') and host_of(x['url']) in NOLINK_HOSTS and not x.get('nolink'):
                err(f'{where}: {host_of(x["url"])} is a carrier\'s own or sales site; set "nolink": true')
            for k, v in x.items():
                walk(v, where)
        elif isinstance(x, list):
            for v in x:
                walk(v, where)
    for name in NODE_FILES:
        for n in g[name]:
            walk(n, f'{name}/{n.get("id")}')
    for i, e in enumerate(g['edges']):
        walk(e, f'edges[{i}] ({e.get("from")} {e.get("type")} {e.get("to")})')
    for i, w in enumerate(g.get('words') or []):
        walk(w, f'words[{i}] ({w.get("id")})')
    # The Watch: every claim says who made it, where, and how far it is checked; the map's own words label no one.
    W_STATUS = {'not checked', 'partly checked', 'checked', 'not supported', 'source not found'}
    W_RESULT = {'supports', 'partly supports', 'does not support', 'not found', 'could not read'}
    W_KIND = {'claimed', 'reported', 'alleged', 'documented', 'first-person'}
    seen_w = set()
    for w in g.get('watch') or []:
        wid = w.get('id', '?')
        for k in ('id', 'date', 'title', 'claim', 'claimed_by', 'standing', 'source', 'status', 'kind'):
            if not str(w.get(k) or '').strip():
                err(f'watch/{wid}: missing "{k}"')
        if not ID.match(str(wid)):
            err(f'watch/{wid}: id must be lower-case letters, digits and hyphens')
        bad_list = False
        for k in ('checks', 'responses', 'open', 'cautions', 'touches', 'travelled'):
            if k in w and not isinstance(w[k], list):
                err(f'watch/{wid}: "{k}" must be a list')
                bad_list = True
        if bad_list:
            continue
        if wid in seen_w or wid in ids:
            err(f'watch/{wid}: duplicate id')
        seen_w.add(wid)
        if w.get('status') not in W_STATUS or w.get('kind') not in W_KIND or not DATE.match(str(w.get('date', ''))):
            err(f'watch/{wid}: bad status, kind or date')
        if w.get('url') and not URL.match(w['url']):
            err(f'watch/{wid}: bad url')
        for c in w.get('checks') or []:
            if not isinstance(c, dict):
                err(f'watch/{wid}: a check must be an object')
                continue
            if not (c.get('what') and c.get('source')) or c.get('result') not in W_RESULT:
                err(f'watch/{wid}: a check needs what, source and a result in {sorted(W_RESULT)}')
            if c.get('verified') and c['verified'] not in VERIFIED:
                err(f'watch/{wid}: a check has a bad verified flag')
            if c.get('url') and not URL.match(c['url']):
                err(f'watch/{wid}: a check has a bad url')
        for r in w.get('responses') or []:
            if not isinstance(r, dict) or not (r.get('who') and r.get('what')):
                err(f'watch/{wid}: a response needs who and what')
        for t in w.get('touches') or []:
            if t not in ids:
                err(f'watch/{wid}: touches unknown id {t}')
        # How it travelled: each step in date order, with who said it, their exact words and where; every step after
        # the first says, neutrally, what changed from the step it cites. The map does not say which version is right.
        last = ''
        for i, t in enumerate(w.get('travelled') or []):
            if not isinstance(t, dict) or not all(str(t.get(k) or '').strip() for k in ('date', 'who', 'said', 'source')):
                err(f'watch/{wid}: a travelled step needs date, who, said and source')
                continue
            if not DATE.match(str(t['date'])) or str(t['date']) < last:
                err(f'watch/{wid}: travelled steps need valid dates, oldest first')
            last = str(t['date'])
            if i and not str(t.get('changed') or '').strip():
                err(f'watch/{wid}: a travelled step after the first must say what changed')
            if t.get('verified') and t['verified'] not in VERIFIED:
                err(f'watch/{wid}: a travelled step has a bad verified flag')
            if t.get('url') and not URL.match(t['url']):
                err(f'watch/{wid}: a travelled step has a bad url')
            sc = t.get('scores')
            if sc is not None and (not isinstance(sc, dict) or any(sc.get(k) is not None and not (isinstance(sc.get(k), (int, float)) and 0 <= sc[k] <= lim)
                                                            for k, lim in (('hedges', 20), ('attribution', 4), ('label', 3)))):
                err(f'watch/{wid}: a travelled step has bad scores')
        voice = [w.get('title', ''), w.get('standing', ''), w.get('claimed_by', ''), w.get('why', '')] + \
            [t.get(k, '') for t in w.get('travelled') or [] if isinstance(t, dict) for k in ('who', 'cites', 'changed')] + [c.get('what', '') for c in w.get('checks') or [] if isinstance(c, dict)] + \
            [r.get(k, '') for r in w.get('responses') or [] if isinstance(r, dict) for k in ('who', 'what')] + list(w.get('cautions') or []) + list(w.get('open') or [])
        for text in voice:
            if LABEL_BAN.search(QUOTED.sub('', str(text))):
                err(f'watch/{wid}: labels a party in the map\'s own voice: {str(text)[:60]}')

        def strings(x, key=None):
            if isinstance(x, str):
                if key not in ('url',):
                    yield x
            elif isinstance(x, list):
                for v in x:
                    yield from strings(v, key)
            elif isinstance(x, dict):
                for k2, v in x.items():
                    yield from strings(v, k2)
        for text in strings(w):
            if INTERNAL.search(text):
                err(f'watch/{wid}: a working note reaches the reader: {text[:60]}')
        walk(w, f'watch/{wid}')
    if g.get('patterns') and not (g.get('meta') or {}).get('made_with'):
        err('meta.json needs "made_with" (who made the records) once the ancient layer is shown')
    # The notes in meta.json are shown to every reader on the opening panels.
    for k in ('note', 'money_note', 'made_with', 'disclosure'):
        if INTERNAL.search(str((g.get('meta') or {}).get(k, ''))):
            err(f'meta.json "{k}": a working note reaches the reader')
    # Threads on the Watch: claims shown together under one neutral heading that says why they are here.
    threads = (g.get('meta') or {}).get('watch_threads') or {}
    if not isinstance(threads, dict):
        err('meta.json "watch_threads" must map a thread id to its title and note')
        threads = {}
    used = set()
    for w in g.get('watch') or []:
        t = w.get('thread')
        if t is None:
            continue
        if t not in threads:
            err(f'watch/{w.get("id")}: thread "{t}" is not described in meta.json "watch_threads"')
        used.add(t)
    for tid, t in threads.items():
        if not ID.match(str(tid)):
            err(f'watch thread {tid}: id must be lower-case letters, digits and hyphens')
        for k in ('title', 'note'):
            text = str((t or {}).get(k) or '')
            if not text.strip():
                err(f'watch thread {tid}: missing "{k}"')
            if LABEL_BAN.search(QUOTED.sub('', text)) or INTERNAL.search(text):
                err(f'watch thread {tid}: "{k}" labels someone or carries a working note')
        if tid not in used:
            err(f'watch thread {tid}: no Watch entry is in it')

    for i, e in enumerate(g['edges']):
        for k in ('from', 'to', 'type', 'sentence'):
            if not e.get(k):
                err(f'edges[{i}]: missing "{k}"')
        if LABEL_BAN.search(QUOTED.sub('', str(e.get('sentence', '')))):
            err(f'edges[{i}]: "sentence" labels a group (guardrail 1): {str(e.get("sentence"))[:60]}')
        if e.get('type') not in EDGE_TYPES:
            err(f'edges[{i}]: unknown type {e.get("type")}')
        # Every record of money says what kind of money it is, so investment and charity are never counted as one.
        if e.get('type') == 'funds' and e.get('money') not in MONEY_KINDS:
            err(f'edges[{i}] ({e.get("from")} funds {e.get("to")}): "money" must be one of {sorted(MONEY_KINDS)}')
        if e.get('money') and e.get('type') != 'funds':
            err(f'edges[{i}]: only a "funds" link carries "money"')
        if e.get('url') and not e.get('nolink') and NOT_LINKED.search(str(e.get('source', '')) + ' ' + str(e.get('sentence', ''))):
            err(f'edges[{i}] ({e.get("from")} {e.get("type")} {e.get("to")}): it says the source is not linked, so it needs "nolink": true')
        for end in ('from', 'to'):
            if e.get(end) not in ids:
                err(f'edges[{i}]: "{end}" points at unknown id {e.get(end)}')
            linked.add(e.get(end))
        if e.get('type') == 'parallels' and ids.get(e.get('to')) != 'texts':
            err(f'edges[{i}]: "parallels" must point at a text')
        if 'texts' in (ids.get(e.get('from')), ids.get(e.get('to'))) and e.get('lens') is not True:
            err(f'edges[{i}]: a link to a text must be marked "lens": true (guardrail 5)')
        if e.get('type') == 'carries' and ids.get(e.get('to')) != 'ideals':
            err(f'edges[{i}]: "carries" must point at an ideal')
        # Patterns and mechanisms are joined only by the ancient links, which their panels list.
        if e.get('type') not in ANCIENT_ENDS and (ids.get(e.get('from')) in ('patterns', 'mechanisms') or ids.get(e.get('to')) in ('patterns', 'mechanisms')):
            err(f'edges[{i}]: a "{e.get("type")}" link cannot touch a pattern or a mechanism')
        for k in ('sentence', 'limit', 'source'):
            # An invocation's sentence carries the speaker's own words, which are theirs to choose.
            text = str(e.get(k, '')).replace(str(e.get('quote', '')), '') if e.get('type') == 'invokes' else str(e.get(k, ''))
            if INTERNAL.search(text):
                err(f'edges[{i}] ({e.get("from")} {e.get("type")} {e.get("to")}): a working note reaches the reader in "{k}": {str(e.get(k))[:60]}')
        if LABEL_BAN.search(QUOTED.sub('', str(e.get('limit', '')))):
            err(f'edges[{i}]: "limit" labels a party in the map\'s own voice')
        key = (e.get('from'), e.get('to'), e.get('type'), e.get('url'), e.get('quote') or e.get('sentence'), e.get('amount'), e.get('date'))
        if key in seen_edges:
            err(f'edges[{i}] ({e.get("from")} {e.get("type")} {e.get("to")}): the same link twice')
        seen_edges.add(key)
        if e.get('type') in ANCIENT_ENDS:
            who = f'edges[{i}] ({e.get("from")} {e.get("type")} {e.get("to")})'
            froms, tos = ANCIENT_ENDS[e['type']]
            if ids.get(e.get('from')) not in froms or ids.get(e.get('to')) not in tos:
                err(f'{who}: a "{e["type"]}" link cannot join {ids.get(e.get("from"))} to {ids.get(e.get("to"))}')
            if e['type'] == 'reads_as' and (e.get('lens') is not True or not e.get('limit')):
                err(f'{who}: a reading must be marked "lens": true and say where it stops ("limit")')
            if e['type'] == 'invokes':
                for k in ('speaker', 'quote', 'source', 'url', 'verified', 'sense'):
                    if not e.get(k):
                        err(f'{who}: missing "{k}"')
                if len(e.get('quote', '')) > MAX_SOURCE or e.get('sense') not in SENSE or e.get('lens'):
                    err(f'{who}: an invocation is a quotation of at most {MAX_SOURCE} characters, with a sense, and not a lens')
                if e.get('verified') == 'primary' and RELAYED.search(str(e.get('speaker', '')) + ' ' + str(e.get('source', ''))):
                    err(f'{who}: words read in a relay cannot be primary')
                # Drawn to an ideal only for an ideal the speaker itself carries (not by a reading).
                if e.get('about') and (ids.get(e['about']) != 'ideals' or not any(
                        x.get('type') == 'carries' and x.get('from') == e['from'] and x.get('to') == e['about'] and not x.get('lens') for x in g['edges'])):
                    err(f'{who}: "about" must be an ideal the speaker carries')
                if e.get('verified') == 'primary' and NOT_OWN.search(str(e.get('source', ''))):
                    err(f'{who}: words read in an interview or a transcript cannot be primary')
            if e['type'] in ('uses', 'breaks_from'):
                for k in ('source', 'url', 'verified', 'kind'):
                    if not e.get(k):
                        err(f'{who}: missing "{k}"')
                if e.get('kind') not in FRUIT_KIND:
                    err(f'{who}: kind must be one of {sorted(FRUIT_KIND)}')
            if e.get('verified') and e['verified'] not in VERIFIED:
                err(f'{who}: verified must be one of {sorted(VERIFIED)}')
            if e.get('url') and not URL.match(e['url']):
                err(f'{who}: bad url')
        if e.get('type') in MONEY_ENDS:
            money += 1
            who = f'edges[{i}] ({e.get("from")} {e.get("type")} {e.get("to")})'
            froms, tos = MONEY_ENDS[e['type']]
            if ids.get(e.get('from')) not in froms or ids.get(e.get('to')) not in tos:
                err(f'{who}: a "{e["type"]}" link cannot join {ids.get(e.get("from"))} to {ids.get(e.get("to"))}')
            if e.get('from') == e.get('to'):
                err(f'{who}: a link from a name to itself')
            for k in ('source', 'url', 'verified', 'kind'):
                if not e.get(k):
                    err(f'{who}: missing "{k}"')
            if e.get('url') and not URL.match(e['url']):
                err(f'{who}: bad url')
            if e.get('verified') not in VERIFIED:
                err(f'{who}: verified must be one of {sorted(VERIFIED)}')
            if e.get('kind') not in FRUIT_KIND:
                err(f'{who}: kind must be one of {sorted(FRUIT_KIND)}')
            if e.get('date') and not DATE.match(str(e['date'])):
                err(f'{who}: date must be YYYY, YYYY-MM or YYYY-MM-DD')
            if e.get('lens'):
                err(f'{who}: a money link is a record, not a lens')
            if MOTIVE_BAN.search(QUOTED.sub('', str(e.get('sentence', '')) + ' ' + str(e.get('amount', '')))):
                err(f'{who}: "sentence" asserts a motive or a verdict; state the record and stop')
    # A pattern holds its own texts; that counts as a link.
    for pat in g.get('patterns') or []:
        linked.update(pat.get('texts') or [])
    for nid, name in ids.items():
        if nid not in linked:
            err(f'{name}/{nid}: not linked to anything')
    if money and not g.get('meta', {}).get('disclosure'):
        err('meta.json needs a "disclosure" line once the map shows money: say what ties the author has to the bodies shown')
    if [p.get('phase') for p in g['phases']] != list(range(6)):
        err('phases.json must define phases 0-5 in order')
    # The front's "Start with a name you know": each must open a record (a node or a person in Who's who).
    person_ids = {p.get('id') for p in g.get('people') or []}
    for fid in (g.get('meta') or {}).get('front_names') or []:
        if fid not in ids and fid not in person_ids:
            err(f'meta.json front_names: {fid!r} is not a record or a person on the map')
    # The families: where each ideal's own words put the made mind (this project's reading). Each has a name, a
    # question and an old line with its source; each ideal names one family, or two when it sits on the line between,
    # or none, and says why in family_note whenever it is not in exactly one.
    fams = (g.get('meta') or {}).get('families') or []
    fam_ids = [f.get('id') for f in fams]
    if fams:
        if len(set(fam_ids)) != len(fam_ids):
            err('meta.json families: two families share an id')
        for f in fams:
            if not all(f.get(k) for k in ('id', 'name', 'question', 'line')):
                err(f'meta.json families: {f.get("id")!r} needs id, name, question and line')
            elif not all((f['line'] or {}).get(k) for k in ('quote', 'ref', 'url', 'verified')):
                err(f'meta.json families: {f["id"]}: its line needs quote, ref, url and verified')
        for d in g['ideals']:
            fam = d.get('family')
            if not isinstance(fam, list) or len(fam) > 2 or len(set(fam)) != len(fam) or any(x not in fam_ids for x in fam):
                err(f'ideals/{d["id"]}: family must list one or two of {fam_ids}, or none')
            elif len(fam) != 1 and not d.get('family_note'):
                err(f'ideals/{d["id"]}: an ideal between two families, or in none, says why in family_note')
    # Who's who: public figures only, each in one plain, sourced sentence that labels no one.
    seen_p, forms = set(), {}
    for i, p in enumerate(g.get('people') or []):
        who = f'people[{i}] ({p.get("id")})'
        for k in ('id', 'name', 'who', 'group', 'source', 'url', 'verified', 'sort'):
            if not str(p.get(k) or '').strip():
                err(f'{who}: missing "{k}"')
        if not ID.match(str(p.get('id', ''))) or p.get('id') in seen_p:
            err(f'{who}: id must be unique, lower-case letters, digits and hyphens')
        seen_p.add(p.get('id'))
        if p.get('group') not in PEOPLE_GROUPS:
            err(f'{who}: group must be one of {sorted(PEOPLE_GROUPS)}')
        if p.get('verified') not in VERIFIED:
            err(f'{who}: verified must be one of {sorted(VERIFIED)}')
        if p.get('url') and not URL.match(p['url']):
            err(f'{who}: bad url')
        if len(str(p.get('who', ''))) > MAX_WHO:
            err(f'{who}: "who" is longer than {MAX_WHO} characters; one plain sentence or two')
        text = QUOTED.sub('', str(p.get('who', '')))
        if LABEL_BAN.search(text) or MOTIVE_BAN.search(text) or INTERNAL.search(text):
            err(f'{who}: "who" labels someone, asserts a motive or carries a working note')
        if p.get('node') and p['node'] not in ids:
            err(f'{who}: node {p["node"]} is not on the map')
        if not isinstance(p.get('match', []), list):
            err(f'{who}: "match" must be a list of the forms of the name to mark')
        for m in p.get('match') or [p.get('name')]:
            if m in forms and forms[m] != p.get('id'):
                err(f'{who}: "{m}" already marks {forms[m]}')
            forms[m] = p.get('id')
    # Alignment methods: what each does in plain words, its bet in its proponents' words, the same five questions.
    def plain_text_ok(where, text):
        t = QUOTED.sub('', str(text or ''))
        if LABEL_BAN.search(t) or MOTIVE_BAN.search(t) or INTERNAL.search(t):
            err(f'{where}: labels someone, asserts a motive or carries a working note')

    def quote_ok(where, q, need=('speaker', 'quote', 'source', 'url', 'verified')):
        for k in need:
            if not str((q or {}).get(k) or '').strip():
                err(f'{where}: missing "{k}"')
        if len(str((q or {}).get('quote', ''))) > MAX_QUOTE:
            err(f'{where}: a quotation is longer than {MAX_QUOTE} characters')
        if (q or {}).get('verified') and q['verified'] not in VERIFIED:
            err(f'{where}: bad verified flag')
        if (q or {}).get('url') and not URL.match(q['url']):
            err(f'{where}: bad url')
    people_ids = {p.get('id') for p in g.get('people') or []}
    method_ids = set()
    for i, m in enumerate(g.get('methods') or []):
        who = f'methods[{i}] ({m.get("id")})'
        if not ID.match(str(m.get('id', ''))) or m.get('id') in method_ids or m.get('id') in ids or m.get('id') in people_ids:
            err(f'{who}: id must be unique across the map, lower-case letters, digits and hyphens')
        method_ids.add(m.get('id'))
        for k in ('label', 'plain'):
            if not str(m.get(k) or '').strip():
                err(f'{who}: missing "{k}"')
        plain_text_ok(who, m.get('plain'))
        quote_ok(f'{who} bet', m.get('bet'))
        if [x.get('q') for x in m.get('key') or []] != METHOD_KEY:
            err(f'{who}: "key" must answer {METHOD_KEY} in that order')
        for x in m.get('key') or []:
            if x.get('kind') == 'own words':
                quote_ok(f'{who} key {x.get("q")}', x)
            elif x.get('kind') == 'reading':
                if x.get('quote'):
                    err(f'{who} key {x.get("q")}: a reading carries no quotation')
            else:
                err(f'{who} key {x.get("q")}: kind must be "own words" or "reading"')
            if not str(x.get('a') or '').strip():
                err(f'{who} key {x.get("q")}: missing the short answer "a"')
            plain_text_ok(f'{who} key {x.get("q")}', x.get('a'))
        for x in m.get('pushed_by') or []:
            if not x.get('name') or not x.get('how'):
                err(f'{who}: each "pushed_by" needs name and how')
            if x.get('node') and x['node'] not in ids:
                err(f'{who}: pushed_by node {x["node"]} is not on the map')
            if x.get('url') and not URL.match(x['url']):
                err(f'{who}: pushed_by has a bad url')
            plain_text_ok(f'{who} pushed_by', x.get('how'))
        for x in m.get('pushback') or []:
            quote_ok(f'{who} pushback', x)
        for x in m.get('happened') or []:
            for k in ('date', 'what', 'source', 'url', 'verified', 'kind'):
                if not str(x.get(k) or '').strip():
                    err(f'{who} happened: missing "{k}"')
            if x.get('kind') not in FRUIT_KIND or not DATE.match(str(x.get('date', ''))):
                err(f'{who} happened: bad kind or date')
            plain_text_ok(f'{who} happened', x.get('what'))
        for c in m.get('cautions') or []:
            plain_text_ok(f'{who} caution', c)
    # Doors: a way in for each viewpoint, every stop a record or a view that exists.
    watch_ids = {w.get('id') for w in g.get('watch') or []}
    door_ids = set()
    for i, d in enumerate(g.get('doors') or []):
        who = f'doors[{i}] ({d.get("id")})'
        if not ID.match(str(d.get('id', ''))) or d.get('id') in door_ids:
            err(f'{who}: id must be unique, lower-case letters, digits and hyphens')
        door_ids.add(d.get('id'))
        for k in ('label', 'lede'):
            if not str(d.get(k) or '').strip():
                err(f'{who}: missing "{k}"')
        plain_text_ok(who, str(d.get('label')) + ' ' + str(d.get('lede')))
        if not d.get('stops'):
            err(f'{who}: a door needs stops')
        for s in d.get('stops') or []:
            if s.get('record') and s['record'] not in ids and s['record'] not in people_ids and s['record'] not in method_ids and s['record'] not in watch_ids:
                err(f'{who}: stop {s["record"]} is not on the map')
            if s.get('view') and s['view'] not in DOOR_VIEWS:
                err(f'{who}: view must be one of {sorted(DOOR_VIEWS)}')
            if not (s.get('record') or s.get('view')) or not s.get('why'):
                err(f'{who}: each stop needs a record or a view, and a "why"')
            plain_text_ok(f'{who} stop', s.get('why'))
    # Words you'll meet: a plain meaning, in the map's voice, for a term a reader may not know. Each says where it goes
    # deeper (a record on the map) or where its meaning was read (a source). A defining quotation is never new here: it
    # must already be on the map, word for word, with the same page and the same flag.
    def quotes_on_map():
        out = set()

        def walk(o):
            if isinstance(o, dict):
                if isinstance(o.get('quote'), str):
                    out.add((o['quote'], o.get('url'), o.get('verified')))
                for v in o.values():
                    walk(v)
            elif isinstance(o, list):
                for v in o:
                    walk(v)
        for k, v in g.items():
            if k not in ('words', 'reread', 'meta', 'phases'):
                walk(v)
        return out
    on_map = quotes_on_map() if g.get('words') else set()
    word_ids, word_forms = set(), {}
    person_forms = {m for p in g.get('people') or [] for m in (p.get('match') or [p.get('name')])}
    for i, w in enumerate(g.get('words') or []):
        who = f'words[{i}] ({w.get("id")})'
        if not ID.match(str(w.get('id', ''))) or w.get('id') in word_ids:
            err(f'{who}: id must be unique, lower-case letters, digits and hyphens')
        word_ids.add(w.get('id'))
        for k in ('word', 'plain'):
            if not str(w.get(k) or '').strip():
                err(f'{who}: missing "{k}"')
        if len(str(w.get('plain', ''))) > MAX_WHO:
            err(f'{who}: "plain" is longer than {MAX_WHO} characters; one plain sentence or two')
        plain_text_ok(who, w.get('plain'))
        see = w.get('see')
        if see and see not in ids and see not in method_ids:
            err(f'{who}: see {see} is not a record or a method on the map')
        if not see and not all(w.get(k) for k in ('source', 'url', 'verified')):
            err(f'{who}: a word with no record to go deeper names where its meaning was read: source, url, verified')
        if w.get('view') and w['view'] not in DOOR_VIEWS:
            err(f'{who}: view must be one of {sorted(DOOR_VIEWS)}')
        if w.get('url') and not URL.match(w['url']):
            err(f'{who}: bad url')
        if w.get('verified') and w['verified'] not in VERIFIED:
            err(f'{who}: bad verified flag')
        said = w.get('said')
        if said:
            quote_ok(f'{who} said', said)
            if (said.get('quote'), said.get('url'), said.get('verified')) not in on_map:
                err(f'{who} said: the quotation must already be on the map, word for word, with the same url and flag')
        forms_ = w.get('match') or [w.get('word')]
        if not isinstance(forms_, list) or not all(isinstance(m, str) and m.strip() for m in forms_):
            err(f'{who}: "match" must be a list of the forms of the word to mark')
            continue
        for m in forms_:
            key = m.lower()
            if key in word_forms and word_forms[key] != w.get('id'):
                err(f'{who}: "{m}" already marks {word_forms[key]}')
            if m in person_forms:
                err(f'{who}: "{m}" already marks a person in who\'s who')
            word_forms[key] = w.get('id')
    # The re-read ledger: one line per page a person has opened and compared with the map.
    cited, seen = cited_urls(g), set()
    for i, r in enumerate(g.get('reread') or []):
        who = f'reread[{i}] ({r.get("url")})'
        if r.get('url') not in cited:
            continue   # dropped in main() with a warning
        if r.get('url') in seen:
            err(f'{who}: listed twice')
        seen.add(r.get('url'))
        if r.get('result') not in REREAD_RESULTS:
            err(f'{who}: result must be one of {sorted(REREAD_RESULTS)}')
        if not DATE.match(str(r.get('date', ''))) or len(str(r.get('date', ''))) != 10:
            err(f'{who}: date must be YYYY-MM-DD')
    return errs


def updated(data_dir, g):
    """The date the record last changed: the last commit that touched the data, or, where there is no git history
    (a copied folder, a shallow clone that misses it), the newest date the records carry."""
    try:
        out = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', '.'], cwd=data_dir, capture_output=True, text=True, timeout=10)
        if out.returncode == 0 and re.match(r'^\d{4}-\d{2}-\d{2}$', out.stdout.strip()):
            return out.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    dates = [str(x.get('date', '')) for x in g.get('watch', []) + g.get('fruits', []) + g.get('reread', [])]
    return max([d[:10] for d in dates if re.match(r'^\d{4}-\d{2}-\d{2}', d)] or [''])


def standalone(site_dir, graph):
    html = open(os.path.join(site_dir, 'index.html'), encoding='utf-8').read()
    css = open(os.path.join(site_dir, 'map.css'), encoding='utf-8').read()
    html = html.replace('<link rel="stylesheet" href="map.css">', '<style>\n' + css + '</style>')
    data = json.dumps(graph, ensure_ascii=False).replace('<', '\\u003c')
    scripts = '<script type="application/json" id="graph-data">' + data + '</script>\n'
    for name in ('layout.js', 'render.js', 'money.js', 'watch.js', 'ancients.js', 'guide.js', 'ideals.js', 'people.js', 'record.js', 'methods.js', 'map.js'):
        js = open(os.path.join(site_dir, name), encoding='utf-8').read()
        tag = f'<script src="{name}"></script>'
        assert tag in html, tag
        html = html.replace(tag + '\n', '')
        scripts += '<script>\n' + js.replace('</script', '<\\/script') + '</script>\n'
    return html.replace('</body>', scripts + '</body>')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default=os.path.join(HERE, 'data'))
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--out', default=None, help='standalone html path (default dist/ideals-map.html)')
    ap.add_argument('--no-site', action='store_true', help='do not write site/graph.json')
    a = ap.parse_args()
    g = load(a.data)
    errs = validate(g)
    # No defendant, victim, member or private person is named in the data or in the research record (spec section 9).
    # The check needs the private name list, which a public copy of the map does not carry.
    if os.path.exists(os.path.join(HERE, 'tools', 'redact_names.json')):
        sys.path.insert(0, os.path.join(HERE, 'tools'))
        import redact
        files = glob.glob(os.path.join(a.data, '*.json')) + glob.glob(os.path.join(HERE, 'research', '**', '*.json'), recursive=True)
        if redact.check_files(sorted(files)):
            errs.append('a name on tools/redact_names.json is left in the files above: run tools/redact.py on them')
    if errs:
        print(f'{len(errs)} problem(s):')
        for e in errs:
            print('  -', e)
        sys.exit(1)
    counts = {k: len(g[k]) for k in NODE_FILES + ['edges']}
    print('valid:', counts)
    cited = cited_urls(g)
    for r in [r for r in g['reread'] if r['url'] not in cited]:
        print(f'warning: a reading of {r["url"]} is kept out: the map no longer cites that page')
    g['reread'] = [r for r in g['reread'] if r['url'] in cited]
    done = {r['url'] for r in g['reread'] if r.get('result') in ('holds', 'corrected')}
    g['sources'] = {'pages': len(cited), 'reread': len(done & cited)}
    # The pages to read before going public: everything behind the Watch and the allegations (tools/sources.py).
    import sources
    gate = {u for u, p in sources.collect(a.data).items() if p['tier'] <= 2}
    g['sources'].update({'gate': len(gate), 'gate_reread': len(done & gate)})
    g['updated'] = updated(a.data, g)
    print(f'sources: {len(cited)} pages cited, {len(done & cited)} re-read by a person (tools/reread.py)')
    if a.check:
        return
    site = os.path.join(HERE, 'site')
    if not a.no_site and os.path.realpath(a.data) != os.path.realpath(os.path.join(HERE, 'data')):
        sys.exit('--data is not data/: pass --no-site so site/graph.json keeps the real data')
    if not a.no_site:
        with open(os.path.join(site, 'graph.json'), 'w', encoding='utf-8') as fh:
            json.dump(g, fh, ensure_ascii=False, indent=1, sort_keys=True)
            fh.write('\n')
    out = a.out or os.path.join(HERE, 'dist', 'ideals-map.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(standalone(site, g))
    print('wrote', os.path.relpath(out, HERE))


if __name__ == '__main__':
    main()
