#!/usr/bin/env python3
"""One plain page per record, so that a search, a shared link or an AI system reaches the record itself.

  python3 tools/pages.py --graph site/graph.json --out dist/site [--public]

writes, under OUT:
  r/<id>/index.html   every record and every Watch claim as a plain page (no script), with its own title,
                      description, preview tags, citation markup and a link into the map
  r/index.html        every record, listed, so readers and crawlers can reach each page
  sitemap.xml         the pages search engines may index
  llms-full.txt       the same records as plain text, each quotation with its source and its checking flag

The gate. A Watch claim, an allegation or an offshoot is kept out of search engines (noindex), out of the sitemap
and out of llms-full.txt until a person has re-read every page it cites (tools/reread.py). Its page is published,
can be opened and shared, and says that it waits for a re-read. Other pages list it without a search snippet.
Without --public every page is noindex, as the rest of the site is.

tools/package.py runs this, from the same graph.json the viewer reads. Every word on these pages comes from the
data, which build.py has checked, or from the fixed sentences below, which say what the map is and how to read it.
"""
import argparse, html, json, os, re, sys
from types import SimpleNamespace

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TYPES = ['ideals', 'carriers', 'vehicles', 'fruits', 'texts', 'funders', 'labs', 'evaluators', 'patterns', 'mechanisms', 'offshoots']
TYPE_WORD = {'ideal': 'Ideal', 'carrier': 'Carrier', 'vehicle': 'Vehicle', 'fruit': 'Event', 'text': 'Text', 'funder': 'Funder',
             'lab': 'AI company', 'evaluator': 'Evaluator', 'pattern': 'Ancient pattern', 'mechanism': 'How it takes hold',
             'offshoot': 'Offshoot'}
VERIFIED = {'primary': 'machine-checked at the source', 'secondary': 'machine-checked on a relay or coverage',
            'unverified': 'not yet checked'}
STATUS = {'not checked': 'Not yet checked', 'partly checked': 'Partly checked',
          'checked': 'Checked: the sources say what the claim says', 'not supported': 'Checked: the sources read do not support it',
          'source not found': 'No primary source found yet'}
RESULT = {'supports': 'supports', 'partly supports': 'partly supports', 'does not support': 'does not support',
          'not found': 'not found', 'could not read': 'could not be read'}
PHASE = {'met': 'met', 'partly': 'partly met', 'not_met': 'not met', 'unknown': 'unknown'}
MONEY = {'funds', 'evaluates', 'hosts'}
ANCIENT = {'invokes', 'reads_as', 'parallels'}
LEDE = {'ideal': 'ideal', 'fruit': 'what', 'pattern': 'summary', 'mechanism': 'definition', 'text': 'quote'}
THREAD_ORDER = ['ideal', 'carrier', 'vehicle', 'funder', 'lab', 'evaluator', 'fruit', 'pattern', 'mechanism', 'text', 'offshoot']
THREAD_NAME = {'ideal': 'Ideals', 'carrier': 'Movements, groups and voices', 'vehicle': 'What it runs on', 'funder': 'Funders',
               'lab': 'AI companies', 'evaluator': 'Evaluators', 'fruit': 'Events', 'pattern': 'Ancient patterns',
               'mechanism': 'How it takes hold', 'text': 'Old texts', 'offshoot': 'Offshoots'}
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
DONE = {'holds', 'corrected'}
# Records about a party, who may want to answer: everything but the old texts, the patterns and the mechanisms.
PARTY = {'carrier', 'vehicle', 'fruit', 'funder', 'lab', 'evaluator', 'offshoot', 'ideal', 'person', 'watch', 'method'}


def E(s):
    return html.escape(str(s if s is not None else ''), quote=True)


def long_date(d):
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', str(d or ''))
    return f'{int(m.group(3))} {MONTHS[int(m.group(2)) - 1]} {m.group(1)}' if m else str(d or '')


def clip(s, n):
    """At most n characters, cut at a word; a cut quotation keeps its closing mark."""
    s = re.sub(r'\s+', ' ', str(s or '')).strip()
    if len(s) <= n:
        return s
    cut = s[:n - 1].rsplit(' ', 1)[0].rstrip(',;:')
    if cut.count('“') > cut.count('”'):
        return cut + '…”'
    return cut + '…'


def index(g):
    by, adj = {}, {}
    for t in TYPES:
        for n in g.get(t) or []:
            n = dict(n, type=t[:-1])
            by[n['id']] = n
            adj[n['id']] = []
    for e in g.get('edges') or []:
        if e.get('from') in by and e.get('to') in by:
            adj[e['from']].append((e, e['to']))
            adj[e['to']].append((e, e['from']))
    people = {p['id']: p for p in g.get('people') or []}
    return SimpleNamespace(
        g=g, by=by, adj=adj, people=people,
        person_of={p['node']: p for p in people.values() if p.get('node') in by},
        watch={w['id']: w for w in g.get('watch') or []},
        methods={m['id']: m for m in g.get('methods') or []},
        reread={r['url']: r for r in g.get('reread') or [] if r.get('result') in DONE},
        meta=g.get('meta') or {})


def name(n):
    return n.get('label') or n.get('ref') or n.get('name') or n.get('title') or n.get('id')


def node_word(n):
    if n['type'] in ('funder', 'carrier') and n.get('kind'):
        return n['kind'][:1].upper() + n['kind'][1:]
    return TYPE_WORD.get(n['type'], n['type'])


def own_sources(x):
    """Every URL a record itself cites, with the best flag any citation of it carries (as record.js)."""
    out, rank = {}, {'primary': 3, 'secondary': 2, 'unverified': 1}

    def walk(o):
        if isinstance(o, list):
            for v in o:
                walk(v)
            return
        if not isinstance(o, dict):
            return
        u = o.get('url')
        if isinstance(u, str) and re.match(r'^https?://', u):
            cur = out.setdefault(u, {'url': u, 'source': o.get('source') or o.get('work') or o.get('title') or u,
                                     'flag': o.get('verified'), 'nolink': bool(o.get('nolink'))})
            if rank.get(o.get('verified'), 0) > rank.get(cur['flag'], 0):
                cur['flag'] = o.get('verified')
            if cur['source'] == u and (o.get('source') or o.get('work') or o.get('title')):
                cur['source'] = o.get('source') or o.get('work') or o.get('title')
        for k, v in o.items():
            if k != 'url':
                walk(v)
    walk(x)
    return list(out.values())


def reread_count(ix, x):
    srcs = own_sources(x)
    return sum(1 for s in srcs if s['url'] in ix.reread), len(srcs)


def is_gated(ix, kind, x):
    """A Watch claim, an allegation or an offshoot waits for a person's re-read of every page it cites."""
    if kind == 'watch' or (kind == 'node' and (x['type'] == 'offshoot' or x.get('kind') == 'alleged')) \
            or (kind == 'edge' and x.get('kind') == 'alleged'):
        done, total = reread_count(ix, x)
        return not total or done < total
    return False


def members_events(ix, id):
    """An ideal's events: those of its carriers and vehicles, as the map's focus view gathers them (layout.js)."""
    seen = {id} | {o for _, o in ix.adj[id]}
    by_reading = {}
    for e, o in ix.adj[id]:
        if by_reading.get(o) is not False:
            by_reading[o] = e.get('lens') is True
    events = {o for o in seen if ix.by[o]['type'] == 'fruit'}
    for m in seen:
        t = ix.by[m]['type']
        if m == id or by_reading.get(m) is True or t not in ('carrier', 'vehicle'):
            continue
        for e, o in ix.adj[m]:
            ot = ix.by[o]['type']
            if ot == 'fruit' and not ix.by[m].get('historical'):
                events.add(o)
            if t == 'carrier' and ot == 'vehicle':
                events.update(k for _, k in ix.adj[o] if ix.by[k]['type'] == 'fruit')
    return events


def phase_summary(ideal):
    out = []
    for p in range(6):
        entry = next((x for x in ideal.get('phases') or [] if x.get('phase') == p), None)
        conds = [c for c in (entry or {}).get('conditions') or [] if not c.get('context')]
        if not conds:
            out.append('unknown')
            continue
        met = sum(c.get('status') == 'met' for c in conds)
        some = sum(c.get('status') in ('met', 'partly') for c in conds)
        known = sum(c.get('status') != 'unknown' for c in conds)
        out.append('unknown' if not known else 'met' if met == len(conds) else 'partly' if some else 'not_met')
    return out


def records(ix):
    """Every page to write: (id, kind, record). kind is node, person, watch or method."""
    out, seen = [], set()
    for n in ix.by.values():
        out.append((n['id'], 'node', n))
    for p in ix.people.values():
        if p.get('node') in ix.by:
            continue
        out.append((p['id'], 'person', p))
    out += [(w['id'], 'watch', w) for w in ix.watch.values()]
    out += [(m['id'], 'method', m) for m in ix.methods.values()]
    for rid, _, _ in out:
        if rid in seen:
            sys.exit(f'pages: two records share the id {rid!r}; each page needs its own address')
        seen.add(rid)
    return out


def target(ix, rid):
    """The page a link to rid opens: a person tied to a node opens the node's page."""
    p = ix.people.get(rid)
    if p and p.get('node') in ix.by:
        return p['node']
    return rid


def own_voice(ix, n):
    """The first quotation spoken by the record's own subject, if any: a page about someone leads with their words."""
    forms = [name(n)]
    p = ix.person_of.get(n['id'])
    if p:
        forms += [p['name']] + list(p.get('match') or [])
    forms = [f.lower() for f in forms if f and len(f) > 2]
    for w in n.get('words') or []:
        sp = str(w.get('speaker') or '').lower()
        if any(f in sp for f in forms):
            return w
    return None


def describe(ix, rid, kind, x):
    """The preview text: the record's own words with who said them and how it was checked; never new framing."""
    if kind == 'watch':
        s = f'{x["claimed_by"]}: “{clip(x["claim"], 180)}” A claim on the Watch ({STATUS.get(x["status"], x["status"])}). ' \
            'A claim on the Watch is not a finding.'
    elif kind == 'method':
        s = x.get('plain') or name(x)
    elif kind == 'person':
        s = x.get('who') or x['name']
    else:
        n, p = x, ix.person_of.get(rid)
        if n['type'] == 'ideal':
            words = n.get('words') or []
            w = words[n['lead']] if isinstance(n.get('lead'), int) and n['lead'] < len(words) else (words[0] if words else None)
            s = n.get('ideal') or ''
            if w:
                s += f' “{clip(w["quote"], 160)}” ({w["speaker"]}; {VERIFIED.get(w.get("verified"), VERIFIED["unverified"])})'
        elif n['type'] == 'text':
            s = f'“{clip(n["quote"], 240)}” {n.get("ref", "")}'
        elif n['type'] == 'fruit':
            s = f'{n.get("date", "")} · {n.get("kind", "")}. {n.get("what", "")}'
        else:
            w = own_voice(ix, n)
            lead = (clip(p['who'], 150) + ' ') if p else ''
            if w:
                # The quotation gives way to the length limit, never the source or the flag after it.
                tail = f' ({clip(w.get("source", ""), 80)}; {VERIFIED.get(w.get("verified"), VERIFIED["unverified"])})'
                room = max(60, 300 - len(lead) - len('In their own words: “”') - len(tail))
                s = lead + f'In their own words: “{clip(w["quote"], room)}”{tail}'
            else:
                s = lead + (n.get(LEDE.get(n['type'], '')) or n.get('note') or '')
        if len(s) < 40:
            s = (s + ' ' if s else '') + counts_line(ix, rid, n)
    return clip(s, 300)


def counts_line(ix, rid, n):
    """A record with little text of its own is described by what it holds, never by a word about it."""
    q = len(n.get('words') or [])
    ev = sum(1 for e, o in ix.adj.get(rid, []) if ix.by[o]['type'] == 'fruit')
    src = len(own_sources(n))
    parts = [f'{q} quotation{"s" if q != 1 else ""}' if q else '', f'{ev} event{"s" if ev != 1 else ""}' if ev else '',
             f'{src} source{"s" if src != 1 else ""}' if src else '']
    held = ', '.join(p for p in parts if p)
    return f'{node_word(n)} on the Ideals Map' + (f': {held}, each with how it was checked.' if held else ', with every link to the rest of the map.')


class Writer:
    """Turns one record into HTML. All text is escaped; links to sources open the source, links to records the page."""

    def __init__(self, ix, public, cards):
        self.ix, self.public, self.cards = ix, public, cards
        m = ix.meta
        self.site = (m.get('site_url') or '').rstrip('/')
        self.updated = ix.g.get('updated')

    # Small pieces -------------------------------------------------------------------------------------------
    def link(self, url, text, nolink=False):
        if nolink or not re.match(r'^https?://', str(url or '')):
            return f'<span class="src">{E(text)}</span>'
        return f'<a class="src" href="{E(url)}" rel="noopener noreferrer">{E(text)}</a>'

    def badge(self, flag, url=None):
        r = self.ix.reread.get(url) if url else None
        word = VERIFIED.get(flag, VERIFIED['unverified'])
        if r:
            return f'<span class="badge badge-reread">{E(word)} · re-read by a person, {E(r.get("date", ""))}</span>'
        return f'<span class="badge badge-{E(flag or "unverified")}">{E(word)}</span>'

    def rec(self, rid, text, gated=False):
        t = target(self.ix, rid)
        rel = ' rel="nofollow"' if gated else ''
        return f'<a href="../{E(t)}/"{rel}>{E(text)}</a>'

    def waiting(self):
        return '<span class="lane reread-mark">not yet re-read by a person</span>'

    def item(self, inner, gated=False):
        """A list item; one that waits for a re-read gives search engines no snippet of it."""
        if gated:
            return f'<li><span data-nosnippet>{inner} {self.waiting()}</span></li>'
        return f'<li>{inner}</li>'

    def section(self, title, note, body):
        if not body:
            return ''
        n = f'<p class="note">{E(note)}</p>' if note else ''
        return f'<section class="sec"><h2 class="sec-h">{E(title)}</h2>{n}{body}</section>\n'

    def ul(self, items, cls='links rec-list'):
        return f'<ul class="{cls}">{"".join(items)}</ul>' if items else ''

    def quotes(self, words):
        out = []
        for w in words or []:
            when = f' ({E(w["date"])}) ' if w.get('date') else ' '
            out.append(f'<blockquote>“{E(w.get("quote"))}”</blockquote><p class="cite"><span>{E(w.get("speaker"))}, </span>'
                       f'{self.link(w.get("url"), w.get("source") or "source", w.get("nolink"))}{when}{self.badge(w.get("verified"), w.get("url"))}</p>')
        return f'<div class="quotes">{"".join(out)}</div>' if out else ''

    def trail(self, srcs):
        primary = sum(s['flag'] == 'primary' for s in srcs)
        checked = sum(s['flag'] in ('primary', 'secondary') for s in srcs)
        reread = sum(s['url'] in self.ix.reread for s in srcs)
        n = len(srcs)
        steps = [('Drafted', 'by AI models made by Anthropic', True, False),
                 ('Checked by a model', f'{checked} of {n} sources' + (f' ({primary} at the source itself)' if primary else '') if n
                  else 'no sources of its own', checked > 0, False),
                 ('Re-read by a person', f'{reread} of {n} sources' if n else '—', bool(n) and reread == n, 0 < reread < n)]
        out = ''.join(f'<div class="trail-step{" is-done" if d else ""}{" is-part" if p else ""}"><span class="trail-dot"></span>'
                      f'<span class="trail-text"><b>{E(a)}</b><span> {E(b)}</span></span></div>' for a, b, d, p in steps)
        return f'<div class="trail">{out}</div>'

    def sources(self, srcs):
        reading = '<span class="lane">a reading or summary</span>'
        items = [f'<li>{self.link(s["url"], s["source"], s["nolink"])} '
                 f'{self.badge(s["flag"], s["url"]) if s["flag"] else reading}</li>' for s in srcs]
        return self.section(f'Sources ({len(srcs)})', 'Every page this record cites, with how it was checked.', self.ul(items))

    def care(self, notes):
        return self.section('Read with care', None, self.ul([f'<li>{E(c)}</li>' for c in notes or []], 'rec-list'))

    def reply_url(self, rid, title, form):
        base = self.ix.meta.get('contribute') or ''
        gh = re.match(r'^(https://github\.com/[^/]+/[^/]+/issues/new)', base)
        if not gh:
            return base
        lead = 'Reply: ' if form == 'reply.yml' else 'Correction: '
        from urllib.parse import quote
        return f'{gh.group(1)}?template={form}&title={quote(lead + title)}&record={quote(rid + " (" + title + ")")}'

    def foot(self, rid, title, kind, hash_):
        canon = f'{self.site}/r/{rid}/' if self.site else ''
        cite = f'“{title}”. The Ideals Map, record {rid}' + (f', as of {long_date(self.updated)}' if self.updated else '') + '.' + \
               (f' {canon}' if canon else '')
        out = [f'<p class="cite-line"><span class="card-k">Cite: </span><span class="cite-text">{E(cite)}</span></p>']
        if self.ix.meta.get('contribute'):
            if kind in PARTY:
                out.append(f'<p class="reply-line reply-party"><span class="reply-ask">Is this about you, or a group you speak for?</span> '
                           f'<a href="{E(self.reply_url(rid, title, "reply.yml"))}" rel="nofollow">Send your reply</a>. It goes on the record '
                           'beside this, in your own words and under your name, once it is confirmed to come from you.</p>')
            out.append(f'<p class="reply-line"><a href="{E(self.reply_url(rid, title, "correction.yml"))}" rel="nofollow">Correct this record</a>: '
                       'a missing side, or a source that does not say what the map says. Do not name private people.</p>')
        out.append(f'<p class="rec-actions"><a href="../../{E(hash_)}">Open it in the map</a> '
                   '<a href="../">Every record</a> <a href="../../heart.html">The heart</a></p>')
        return '<div class="rec-foot">' + ''.join(out) + '</div>'

    # One record ----------------------------------------------------------------------------------------------
    def own_words(self, rid, person):
        """Quotations anywhere on the map whose speaker is this person or body (as record.js ownWords)."""
        n = self.ix.by.get(rid)
        forms = ([person['name']] + list(person.get('match') or [])) if person else []
        if n and n.get('label') and not person:
            forms.append(re.sub(r'\s*\([^)]*\)\s*$', '', n['label']))
            forms += re.findall(r'\(([^)]+)\)', n['label'])[:1]
        forms = [f for f in forms if f and len(f) > 2]
        if not forms:
            return []
        rx = re.compile(r'(^|[^A-Za-z])(' + '|'.join(re.escape(f) for f in forms) + r')(?![A-Za-z])')
        out, seen = [], set()

        def take(w, at):
            if w.get('quote') and rx.search(str(w.get('speaker') or '')) and w['quote'] not in seen:
                seen.add(w['quote'])
                out.append((w, at))
        for k, x in self.ix.by.items():
            for w in x.get('words') or []:
                take(w, k)
        for e in self.ix.g.get('edges') or []:
            if e.get('quote'):
                take(e, e['to'] if e.get('from') == rid else e.get('from'))
        return sorted(out, key=lambda o: str(o[0].get('date') or ''), reverse=True)

    def glance(self, rid, n, person):
        """At a glance: a person's or a body's own words, money in and out, events and Watch claims, a few lines each."""
        ix = self.ix
        if not person and not (n and n['type'] in ('lab', 'funder', 'evaluator')):
            return ''
        blocks = []

        def block(title, total, items):
            if total:
                blocks.append(f'<div class="glance-block"><h3 class="rec-sub">{E(title)} ({total})</h3>{self.ul(items)}</div>')
        words = self.own_words(rid, person)
        block('In their own words' if person else 'In its own words and its people’s', len(words), [
            f'<li class="glance-quote"><q>{E(w["quote"])}</q><span class="cite"> {E(w.get("speaker"))}, '
            f'{self.link(w.get("url"), w.get("source") or "source", w.get("nolink"))}{" (" + E(w["date"]) + ")" if w.get("date") else ""} '
            f'{self.badge(w.get("verified"), w.get("url"))}'
            + (f' · on {self.rec(at, name(ix.by[at]))}' if at and at != rid and at in ix.by else '') + '</span></li>'
            for w, at in words[:3]])
        verb = {'funds': ('to', 'from'), 'evaluates': ('evaluates', 'evaluated by'), 'hosts': ('hosts', 'hosted by')}
        money = sorted(((e, o) for e, o in ix.adj.get(rid, []) if e.get('type') in MONEY), key=lambda l: str(l[0].get('date') or ''), reverse=True)
        block('Money, hosting and evaluation', len(money), [self.item(
            (f'<span class="rec-date">{E(e["date"])} </span>' if e.get('date') else '') +
            f'<span>{E(verb.get(e["type"], (e["type"], e["type"]))[1 if e.get("to") == rid else 0])} </span>{self.rec(o, name(ix.by[o]))}' +
            (f'<span class="lane">{E(e["amount"])}</span>' if e.get('amount') else '') +
            (f' {self.link(e["url"], "source", e.get("nolink"))}' if e.get('url') else '') +
            (f' {self.badge(e["verified"], e.get("url"))}' if e.get('verified') else ''), is_gated(ix, 'edge', e)) for e, o in money[:5]])
        evs = sorted({o for e, o in ix.adj.get(rid, []) if ix.by[o]['type'] == 'fruit' and e.get('type') not in MONEY},
                     key=lambda k: str(ix.by[k].get('date')), reverse=True)
        block('What has happened', len(evs), [self.item(
            f'<span class="rec-date">{E(ix.by[k].get("date"))} </span>{self.rec(k, ix.by[k].get("label") or ix.by[k].get("what"), is_gated(ix, "node", ix.by[k]))}'
            f'<span class="lane">{E(ix.by[k].get("kind"))}</span>', is_gated(ix, 'node', ix.by[k])) for k in evs[:3]])
        rx = None
        if person:
            forms = person.get('match') or [person['name']]
            rx = re.compile(r'(^|[^A-Za-z])(' + '|'.join(re.escape(f) for f in forms) + r')(?![A-Za-z])')
        claims = sorted((w for w in ix.watch.values() if rid in (w.get('touches') or [])
                         or (rx and rx.search(json.dumps(w, ensure_ascii=False)))), key=lambda w: str(w['date']), reverse=True)
        block('Claims on the Watch', len(claims), [self.item(
            f'<span class="rec-date">{E(w["date"])} </span>{self.rec(w["id"], w["title"], is_gated(ix, "watch", w))}'
            f'<span class="lane">{E(STATUS.get(w["status"], w["status"]))}</span>', is_gated(ix, 'watch', w)) for w in claims[:3]])
        if not blocks:
            return ''
        return ('<section class="glance" aria-label="At a glance"><h2 class="sec-h">At a glance</h2>'
                f'<div class="glance-cols">{"".join(blocks)}</div><p class="note">A few lines of each, newest first; the full record '
                'follows. A claim on the Watch is not a finding, and a record of money is not a finding about motive.</p></section>\n')

    def node_body(self, rid, n):
        ix, out = self.ix, []
        p = ix.person_of.get(rid)
        head = [f'<p class="kicker">{E(node_word(n))}</p>', f'<h1 class="rec-title">{E(name(n))}</h1>']
        if p:
            head.append(f'<p class="rec-who"><span>{E(p["who"])} </span>{self.link(p.get("url"), p.get("source"), p.get("nolink"))}</p>')
        lede = n.get(LEDE.get(n['type'], '')) or n.get('note') or n.get('status') or ''
        gl = self.glance(rid, n, p)
        lede_html = ''
        if lede and not (p and lede == p.get('who')):
            lede_html = f'<p class="rec-lede">{E("“" + lede + "” " + n.get("ref", "") if n["type"] == "text" else lede)}</p>'
            if not gl:
                head.append(lede_html)
        if n['type'] == 'text':
            tr = n.get('tradition') or 'Hebrew Bible'
            src = f' {self.link(n["url"], "source")} {self.badge(n.get("verified"), n["url"])}' if n.get('url') else ''
            head.append(f'<p class="cite"><span>{E(tr)} · {E(n.get("translation") or "King James Version")}.</span>{src}</p>')
        if n['type'] == 'fruit':
            head.append(f'<p class="cite"><span>{E(n.get("date"))} · {E(n.get("kind"))} · </span>'
                        f'{self.link(n.get("url"), n.get("source") or "source", n.get("nolink"))} {self.badge(n.get("verified"), n.get("url"))}</p>')
        if n['type'] == 'ideal' and n.get('summary'):
            head.append(f'<p>{E(n["summary"])}</p>')
        srcs = own_sources(dict(n, **({'_person': p} if p else {})))
        head.append(self.trail(srcs))
        out.append('<header class="rec-head">' + ''.join(head) + '</header>')
        if gl:
            out.append(gl + (self.section('About', None, lede_html) if lede_html else ''))
        if n['type'] == 'ideal':
            phases, summ = ix.g.get('phases') or [], phase_summary(n)
            items = [f'<li class="ph-{s}"><b>{E(ph.get("name"))}: </b><span>{E(ph.get("what"))} </span><span class="lane">{E(PHASE[s])}</span></li>'
                     for ph, s in zip(phases, summ)]
            out.append(self.section('Where it stands', 'Six steps an ideal can pass through. Each turns when its conditions are met, '
                                    'never on a date. Nothing here is a forecast.', f'<ol class="rec-phases">{"".join(items)}</ol>'))
        out.append(self.section('In their own words', None, self.quotes(n.get('words'))))
        if n.get('policy'):
            out.append(self.section('Its own rule on funding', None, self.quotes([n['policy']])))
        pushes = [(m, next((x for x in m.get('pushed_by') or [] if x.get('node') == rid), None)) for m in ix.methods.values()]
        out.append(self.section('Alignment methods it pushes or uses', None, self.ul(
            [f'<li>{self.rec(m["id"], m["label"])}<span>{E(" — " + how["how"]) if how.get("how") else ""}</span></li>'
             for m, how in pushes if how])))
        adj = ix.adj[rid]
        ev = members_events(ix, rid) if n['type'] == 'ideal' else set()
        ev |= {o for e, o in adj if ix.by[o]['type'] == 'fruit' and e.get('type') not in MONEY}
        evs = sorted((ix.by[k] for k in ev), key=lambda f: str(f.get('date')), reverse=True)
        out.append(self.section(f'What has happened ({len(evs)})', 'Newest first. Documented: a record shows it. Reported: the press '
                                'says so. Alleged: someone accuses; nothing is decided.', self.ul([self.item(
                                    f'<span class="rec-date">{E(f.get("date"))} </span>{self.rec(f["id"], f.get("label") or f.get("what"), is_gated(ix, "node", f))}'
                                    f'<span class="lane">{E(f.get("kind"))}</span> {self.badge(f.get("verified"), f.get("url"))}',
                                    is_gated(ix, 'node', f)) for f in evs])))
        money = [(e, o) for e, o in adj if e.get('type') in MONEY]
        out.append(self.section(f'Money, hosting and evaluation ({len(money)})', 'A record of money is not a finding about anyone’s work '
                                'or motive. Amounts are as each source gives them; do not add them up.', self.ul([self.item(
                                    f'<span>{E(e.get("sentence"))} </span>' + (f'<span class="lane">{E(e["amount"])}</span> ' if e.get('amount') else '') +
                                    (self.link(e['url'], e.get('source') or 'source', e.get('nolink')) + ' ' if e.get('url') else '') +
                                    (self.badge(e['verified'], e.get('url')) + ' ' if e.get('verified') else '') + self.rec(o, '→ ' + name(ix.by[o])),
                                    is_gated(ix, 'edge', e)) for e, o in money])))
        anc = [(e, o) for e, o in adj if e.get('type') in ANCIENT]
        anc.sort(key=lambda l: (l[0]['type'] != 'invokes',))
        out.append(self.section('What older traditions called it', 'Own words are a speaker’s; a reading is this project’s and says '
                                'where the likeness stops. A reading never proves anything.', self.ul([
                                    f'<li><span class="lane">{"own words" if e["type"] == "invokes" else "this project’s reading"}</span>'
                                    f'<span> {E((e.get("sentence") or "") + (" Where it stops: " + e["limit"] if e.get("limit") else ""))} </span>'
                                    f'{self.rec(o, "→ " + name(ix.by[o]))}</li>' for e, o in anc])))
        rest = [(e, o) for e, o in adj if e.get('type') not in MONEY | ANCIENT and ix.by[o]['type'] != 'fruit']
        groups, body = {}, ''
        for e, o in rest:
            groups.setdefault(ix.by[o]['type'], []).append((e, o))
        for t in THREAD_ORDER:
            if t in groups:
                body += f'<h3 class="rec-sub">{E(THREAD_NAME[t])}</h3>' + self.ul([self.item(
                    f'{self.rec(o, name(ix.by[o]), is_gated(ix, "node", ix.by[o]))}<span> — {E(e.get("sentence") or e["type"].replace("_", " "))}</span>'
                    + ('<span class="lane">a reading</span>' if e.get('lens') else ''),
                    is_gated(ix, 'edge', e) or is_gated(ix, 'node', ix.by[o])) for e, o in groups[t]])
        claims = [w for w in ix.watch.values() if rid in (w.get('touches') or [])]
        if claims:
            body += '<h3 class="rec-sub">Claims on the Watch</h3>' + self.ul([self.item(
                f'<span class="rec-date">{E(w["date"])} </span>{self.rec(w["id"], w["title"], is_gated(ix, "watch", w))}',
                is_gated(ix, 'watch', w)) for w in claims])
        if p:
            body += self.mentions(rid, p, claims)
        out.append(self.section('Threads', 'Everything this record links to, and how.', body))
        out.append(self.care((n.get('cautions') or []) + ([n['why_not']] if n.get('why_not') else [])))
        out.append(self.sources(srcs))
        return ''.join(out), srcs

    def mentions(self, rid, p, claims):
        forms = p.get('match') or [p['name']]
        rx = re.compile(r'(^|[^A-Za-z])(' + '|'.join(re.escape(f) for f in forms) + r')(?![A-Za-z])')
        hits = [k for k, n in self.ix.by.items() if k != rid and rx.search(json.dumps(n, ensure_ascii=False))]
        hits.sort(key=lambda k: THREAD_ORDER.index(self.ix.by[k]['type']))
        wh = [w for w in self.ix.watch.values() if w not in claims and rx.search(json.dumps(w, ensure_ascii=False))]
        items = [self.item(f'{self.rec(k, name(self.ix.by[k]), is_gated(self.ix, "node", self.ix.by[k]))}'
                           f'<span class="lane">{E(node_word(self.ix.by[k]))}</span>', is_gated(self.ix, 'node', self.ix.by[k])) for k in hits]
        items += [self.item(f'{self.rec(w["id"], w["title"], is_gated(self.ix, "watch", w))}<span class="lane">claim on the Watch</span>',
                            is_gated(self.ix, 'watch', w)) for w in wh]
        return (f'<h3 class="rec-sub">Where {E(p["name"])} is mentioned</h3>' + self.ul(items)) if items else ''

    def person_body(self, rid, p):
        srcs = own_sources(p)
        head = (f'<header class="rec-head"><p class="kicker">Who’s who</p><h1 class="rec-title">{E(p["name"])}</h1>'
                f'<p class="rec-who"><span>{E(p.get("who"))} </span>{self.link(p.get("url"), p.get("source"), p.get("nolink"))}</p>'
                f'{self.trail(srcs)}</header>') + self.glance(rid, None, p)
        body = self.mentions(rid, p, [])
        return head + self.section('Threads', 'Where this name appears on the map.', body) + self.sources(srcs), srcs

    def watch_body(self, rid, w):
        ix, srcs = self.ix, own_sources(w)
        done, total = reread_count(ix, w)
        mark = 're-read by a person' if total and done == total else (f're-read by a person: {done} of {total} sources' if done
                                                                       else 'not yet re-read by a person')
        out = [f'<header class="rec-head"><p class="kicker">A claim on the Watch</p>'
               f'<p class="claim-head"><time>{E(w["date"])}</time> <span class="claim-status status-{E(w["status"].replace(" ", "-"))}">'
               f'{E(STATUS.get(w["status"], w["status"]))}</span> <span class="lane">{E(w.get("kind"))}</span> '
               f'<span class="lane reread-mark{" is-done" if total and done == total else ""}">{E(mark)}</span></p>'
               f'<h1 class="rec-title">{E(w["title"])}</h1>'
               f'<p class="claim-said"><span>{E(w["claimed_by"])}: </span><q>{E(w["claim"])}</q> {self.link(w.get("url"), w.get("source"), w.get("nolink"))}</p>']
        if w.get('standing'):
            out.append(f'<p class="claim-standing">Who is speaking: {E(w["standing"])}</p>')
        if w.get('why'):
            out.append(f'<p class="claim-why">Why this is here: {E(w["why"])}</p>')
        out.append('<p class="note">A claim on the Watch is not a finding, and an unchecked claim is not false.</p>')
        out.append(self.trail(srcs) + '</header>')
        steps = w.get('travelled') or []
        if steps:
            items = []
            for t in steps:
                src = self.link(t['url'], t.get('source'), t.get('nolink')) if t.get('url') else f'<span class="cite">({E(t.get("source"))})</span>'
                li = f'<li class="step"><time>{E(t.get("date"))}</time><span> {E(t.get("who"))}: </span><q>{E(t.get("said"))}</q> {src} ' + \
                     (self.badge(t['verified']) if t.get('verified') else '')
                if t.get('cites'):
                    li += f'<div class="step-note">Gives as its source: {E(t["cites"])}</div>'
                if t.get('changed'):
                    li += f'<div class="step-note step-changed">What changed: {E(t["changed"])}</div>'
                items.append(li + '</li>')
            summ = f'<p class="note step-summary">{E(w["travelled_summary"])}</p>' if w.get('travelled_summary') else ''
            out.append(self.section(f'How it travelled ({len(steps)} steps)', 'Each step in date order: who said it, their words, where '
                                    'they got it, and what changed from the step before. This does not say which version is right.',
                                    summ + f'<ol class="links travelled">{"".join(items)}</ol>'))
        out.append(self.section(f'What has been checked ({len(w.get("checks") or [])})', 'Each line says what was looked for, where, and '
                                'what the page said.', self.ul([
                                    f'<li class="check"><span class="lane result-{E(c["result"].replace(" ", "-"))}">{E(RESULT.get(c["result"], c["result"]))}</span>'
                                    f'<span> {E(c.get("what"))} </span>' + (self.link(c['url'], c.get('source'), c.get('nolink')) if c.get('url')
                                                                         else f'<span class="cite">({E(c.get("source"))})</span>') +
                                    (' ' + self.badge(c['verified'], c.get('url')) if c.get('verified') else '') + '</li>'
                                    for c in w.get('checks') or []], 'links')))
        out.append(self.section('Responses on the record', None, self.ul([
            f'<li><span>{E(r.get("who"))}: {E(r.get("what"))} </span>' + (self.link(r['url'], r.get('source'), r.get('nolink')) if r.get('url')
                                                                         else E(r.get('source') or '')) + '</li>'
            for r in w.get('responses') or []], 'links')))
        out.append(self.section('Still open', None, self.ul([f'<li>{E(o)}</li>' for o in w.get('open') or []], 'rec-list')))
        out.append(self.care(w.get('cautions')))
        on = [k for k in w.get('touches') or [] if k in ix.by]
        if on:
            out.append('<p class="claim-on"><span>On the map: </span>' + ', '.join(self.rec(k, name(ix.by[k])) for k in on) + '</p>')
        out.append(self.sources(srcs))
        return ''.join(out), srcs

    def method_body(self, rid, m):
        srcs = own_sources(m)
        out = [f'<header class="rec-head"><p class="kicker">Alignment method</p><h1 class="rec-title">{E(m["label"])}</h1>'
               f'<p class="rec-lede">{E(m.get("plain"))}</p>{self.trail(srcs)}</header>']
        if m.get('bet'):
            out.append(self.section('What it bets on', 'In its proponents’ own words.', self.quotes([m['bet']])))
        key = ''.join(f'<dt>{E(k.get("q"))}</dt><dd><p>{E(k.get("a"))}</p>{self.quotes([k]) if k.get("quote") else ""}</dd>'
                      for k in m.get('key') or [])
        out.append(self.section('The five questions', 'The same five, asked of every method.', f'<dl class="glossary mk-key">{key}</dl>' if key else ''))
        out.append(self.section('Who pushes it', None, self.ul([
            f'<li>{self.rec(x["node"], x.get("name") or x["node"]) if x.get("node") in self.ix.by else E(x.get("name"))}'
            f'<span> — {E(x.get("how"))} </span>{self.link(x.get("url"), x.get("source") or "source", x.get("nolink"))} '
            f'{self.badge(x.get("verified"), x.get("url"))}</li>' for x in m.get('pushed_by') or []])))
        out.append(self.section('What has happened', None, self.ul([
            f'<li><span class="rec-date">{E(f.get("date"))} </span><span>{E(f.get("what"))} </span>'
            f'{self.link(f.get("url"), f.get("source") or "source", f.get("nolink"))} <span class="lane">{E(f.get("kind"))}</span> '
            f'{self.badge(f.get("verified"), f.get("url"))}</li>' for f in m.get('happened') or []])))
        out.append(self.section('The pushback', 'Critics in their own words.', self.quotes(m.get('pushback'))))
        out.append(self.care(m.get('cautions')))
        out.append(self.sources(srcs))
        return ''.join(out), srcs

    # The page around it -------------------------------------------------------------------------------------
    def page(self, rid, kind, x):
        ix = self.ix
        if kind == 'node':
            body, srcs = self.node_body(rid, x)
            title, hash_ = name(x), '#r/' + rid
        elif kind == 'person':
            body, srcs = self.person_body(rid, x)
            title, hash_ = x['name'], '#r/' + rid
        elif kind == 'watch':
            body, srcs = self.watch_body(rid, x)
            title, hash_ = x['title'], '#watch/' + rid
        else:
            body, srcs = self.method_body(rid, x)
            title, hash_ = x['label'], '#r/' + rid
        gated = is_gated(ix, 'node' if kind == 'node' else kind, x)
        desc = describe(ix, rid, kind, x)
        canon = f'{self.site}/r/{rid}/' if self.site else ''
        tab = f'{title} · The Watch · The Ideals Map' if kind == 'watch' else f'{title} · The Ideals Map'
        robots = '' if self.public and not gated else \
            ('<meta name="robots" content="noindex">\n' if self.public else '<meta name="robots" content="noindex, nofollow">\n')
        img = self.cards.get(rid) or self.cards.get('home')
        meta = [f'<meta name="description" content="{E(desc)}">',
                f'<meta property="og:site_name" content="The Ideals Map">', f'<meta property="og:type" content="article">',
                f'<meta property="og:title" content="{E(title)}">', f'<meta property="og:description" content="{E(desc)}">',
                f'<meta name="twitter:card" content="{"summary_large_image" if img else "summary"}">']
        if canon:
            meta += [f'<link rel="canonical" href="{E(canon)}">', f'<meta property="og:url" content="{E(canon)}">']
        if img and self.site:
            meta += [f'<meta property="og:image" content="{E(self.site + "/" + img)}">', '<meta property="og:image:width" content="1200">',
                     '<meta property="og:image:height" content="630">', f'<meta property="og:image:alt" content="{E(title)}">']
        if self.updated:
            meta.append(f'<meta property="article:modified_time" content="{E(self.updated)}">')
        ld = '' if gated else self.ld(rid, kind, x, title, desc, canon, srcs)
        gate = ''
        if gated:
            done, total = reread_count(ix, x)
            gate = (f'<p class="gate-note" data-nosnippet>A person has re-read {done} of {total} pages this record cites. Until every one is '
                    're-read, search engines are asked not to index this page. It can be opened, shared and answered.'
                    + (' A claim on the Watch is not a finding.' if kind == 'watch' else '') + '</p>')
        s = ix.g.get('sources') or {}
        draft = ''
        if s.get('gate') and s.get('gate_reread', 0) < s['gate']:
            draft = (f'<p class="draft-note" data-nosnippet>Published early, as a draft. AI models gathered and checked these records; a person is '
                     f'now re-reading the sources, starting with the {s["gate"]} pages behind the Watch and the allegations '
                     f'({s.get("gate_reread", 0)} done so far).</p>')
        tag = 'draft' if self.public else 'private prototype'
        made = E(ix.meta.get('made_with') or '')
        return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{robots}<title>{E(tab)}</title>
{chr(10).join(meta)}
<link rel="alternate" type="application/atom+xml" title="The Ideals Map: new claims and events" href="../../feed.xml">
<link rel="stylesheet" href="../../map.css">
{ld}</head>
<body>
<div class="viz-root static-page">
<header class="top static-top"><p class="static-brand"><a href="../../">The Ideals Map</a> <span class="tag">{tag}</span></p>
<p class="static-nav"><a href="../">Every record</a> <a href="../../#start">Start here</a> <a href="../../{E(hash_)}">Open it in the map</a></p></header>
{draft}<main class="static-main">
{gate}<article class="record">
{body}{self.foot(rid, title, x['type'] if kind == 'node' else kind, hash_)}
</article>
</main>
<footer class="static-foot"><p>The Ideals Map is a record, not a verdict. Every item says who is speaking, quotes them, links the source and
says how it was checked. {made}</p><p>Data and the map’s own text: CC BY 4.0. Quoted words belong to their authors.</p></footer>
</div>
</body>
</html>
'''

    def ld(self, rid, kind, x, title, desc, canon, srcs):
        """Citation markup (schema.org): what the page is, the pages it cites, and the quotations with who said them.
        No rating of any claim: a ClaimReview would need one, and the map gives no verdicts."""
        d = {'@context': 'https://schema.org', '@type': 'WebPage', 'name': title, 'description': desc, 'inLanguage': 'en',
             'license': 'https://creativecommons.org/licenses/by/4.0/',
             'isPartOf': {'@type': 'WebSite', 'name': 'The Ideals Map', **({'url': self.site + '/'} if self.site else {})}}
        if canon:
            d['url'] = canon
        if self.updated:
            d['dateModified'] = self.updated
        cites = [s['url'] for s in srcs if not s['nolink']]
        if cites:
            d['citation'] = cites
        words = list(x.get('words') or []) if kind == 'node' else []
        if kind == 'method':
            words = [w for w in [x.get('bet')] + list(x.get('pushback') or []) if w]
        parts = [{'@type': 'Quotation', 'text': w['quote'], 'creditText': w.get('speaker'),
                  **({'isBasedOn': w['url']} if w.get('url') and not w.get('nolink') else {})} for w in words if w.get('quote')]
        if parts:
            d['hasPart'] = parts[:25]
        if kind == 'watch':
            d['mainEntity'] = {'@type': 'Claim', 'text': x['claim'], 'creditText': x['claimed_by'], 'datePublished': x['date'],
                               **({'firstAppearance': {'@type': 'CreativeWork', 'name': x.get('source'), 'url': x['url']}}
                                  if x.get('url') and not x.get('nolink') else {})}
        p = self.ix.person_of.get(rid) if kind == 'node' else (x if kind == 'person' else None)
        if p:
            d['about'] = {'@type': 'Person', 'name': p['name'], 'description': p.get('who'),
                          **({'sameAs': p['url']} if 'wikipedia.org' in str(p.get('url')) else {})}
        js = json.dumps(d, ensure_ascii=False, indent=None).replace('</', '<\\/')
        return f'<script type="application/ld+json">{js}</script>\n'


# Preview cards -------------------------------------------------------------------------------------------------
def card_text(g, cid):
    """What a preview image says (tools/cards.py draws it). A card is used only while its words still match the data."""
    if cid == 'home':
        return {'kicker': 'A public record, published as a draft', 'title': 'The Ideals Map',
                'lede': 'What the people building and promoting AI say it is for, who says it, what has happened and who pays.',
                'quote': '', 'who': '', 'foot': 'The source and how it was checked on every line · a record, not a verdict'}
    n = next((d for d in g.get('ideals') or [] if d['id'] == cid), None)
    if not n:
        return None
    words = n.get('words') or []
    w = words[n['lead']] if isinstance(n.get('lead'), int) and n['lead'] < len(words) else (words[0] if words else None)
    return {'kicker': 'An ideal on the Ideals Map', 'title': n['label'], 'lede': n.get('ideal') or '',
            'quote': clip('“' + w['quote'] + '”', 190) if w else '',
            'who': (w['speaker'] + ' · ' + VERIFIED.get(w.get('verified'), VERIFIED['unverified'])) if w else '',
            'foot': 'The source and how it was checked on every line · a record, not a verdict'}


def card_hash(text):
    import hashlib
    return hashlib.sha1(json.dumps(text, sort_keys=True, ensure_ascii=False).encode('utf-8')).hexdigest()[:16]


def fresh_cards(g, cards_dir):
    """{id: 'cards/<file>'} for every card whose words still match the data; a stale card is left unused."""
    try:
        made = json.load(open(os.path.join(cards_dir, 'cards.json'), encoding='utf-8'))
    except (OSError, ValueError):
        return {}
    out = {}
    for cid, c in made.items():
        t = card_text(g, cid)
        if t and c.get('hash') == card_hash(t) and os.path.exists(os.path.join(cards_dir, c['file'])):
            out[cid] = 'cards/' + c['file']
    return out


# Every record, the sitemap and the plain text ------------------------------------------------------------------
GROUPS = [('ideal', 'Ideals'), ('carrier', 'Movements, groups and voices'), ('person', 'Who’s who'), ('vehicle', 'What it runs on'),
          ('funder', 'Funders'), ('lab', 'AI companies'), ('evaluator', 'Evaluators'), ('method', 'Alignment methods'),
          ('watch', 'The Watch: claims in circulation'), ('fruit', 'Events'), ('offshoot', 'Offshoots'), ('pattern', 'Ancient patterns'),
          ('mechanism', 'How it takes hold'), ('text', 'Old texts')]


def group_of(kind, x):
    return x['type'] if kind == 'node' else kind


def title_of(kind, x):
    return name(x) if kind == 'node' else x['name'] if kind == 'person' else x['title'] if kind == 'watch' else x['label']


def listing(ix, recs, public):
    w = Writer(ix, public, {})
    body = []
    for key, head in GROUPS:
        rs = [(rid, kind, x) for rid, kind, x in recs if group_of(kind, x) == key]
        if not rs:
            continue
        if key in ('fruit', 'watch'):
            rs.sort(key=lambda r: str(r[2].get('date')), reverse=True)
        items = []
        for rid, kind, x in rs:
            g = is_gated(ix, 'node' if kind == 'node' else kind, x)
            date = f'<span class="rec-date">{E(x.get("date"))} </span>' if key in ('fruit', 'watch') else ''
            rel = ' rel="nofollow"' if g else ''
            items.append(w.item(f'{date}<a href="{E(rid)}/"{rel}>{E(title_of(kind, x))}</a>', g))
        body.append(f'<section class="sec"><h2 class="sec-h">{E(head)} ({len(rs)})</h2><ul class="links rec-list">{"".join(items)}</ul></section>')
    site = (ix.meta.get('site_url') or '').rstrip('/')
    robots = '' if public else '<meta name="robots" content="noindex, nofollow">\n'
    canon = f'<link rel="canonical" href="{E(site)}/r/">\n' if site else ''
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{robots}<title>Every record · The Ideals Map</title>
<meta name="description" content="Every record on the Ideals Map as a plain page: the ideals, the people and groups who carry them, events, funders, evaluators, the Watch and the older texts, each with its sources and how they were checked.">
{canon}<link rel="stylesheet" href="../map.css">
</head>
<body>
<div class="viz-root static-page">
<header class="top static-top"><p class="static-brand"><a href="../">The Ideals Map</a> <span class="tag">{"draft" if public else "private prototype"}</span></p>
<p class="static-nav"><a href="../#start">Start here</a> <a href="../heart.html">The heart</a> <a href="../llms-full.txt">All of it as text</a></p></header>
<main class="static-main">
<h1 class="rec-title">Every record</h1>
<p class="rec-lede">{len(recs)} records, each on a plain page of its own with its sources and how they were checked. The map draws the same records and the links between them.</p>
{chr(10).join(body)}
</main>
</div>
</body>
</html>
'''


def sitemap(ix, recs, public):
    site = (ix.meta.get('site_url') or '').rstrip('/')
    if not site or not public:
        return None
    lastmod = f'<lastmod>{E(ix.g.get("updated"))}</lastmod>' if ix.g.get('updated') else ''
    urls = [site + '/', site + '/heart.html', site + '/r/']
    urls += [f'{site}/r/{rid}/' for rid, kind, x in recs if not is_gated(ix, 'node' if kind == 'node' else kind, x)]
    rows = ''.join(f'<url><loc>{E(u)}</loc>{lastmod}</url>\n' for u in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{rows}</urlset>\n'


def flag_word(v, url, ix):
    word = VERIFIED.get(v, VERIFIED['unverified'])
    return word + ('; re-read by a person' if url in ix.reread else '')


def text_quote(w, ix):
    src = w.get('source') or ''
    at = '' if w.get('nolink') or not w.get('url') else f' <{w["url"]}>'
    return f'- “{w.get("quote")}” ({w.get("speaker")}, {src}{at}; {flag_word(w.get("verified"), w.get("url"), ix)})'


def full_text(ix, recs):
    """llms-full.txt: every record a search engine may index, as plain text, every quotation with its flag beside it."""
    site = (ix.meta.get('site_url') or '').rstrip('/')
    held = [r for r in recs if is_gated(ix, 'node' if r[1] == 'node' else r[1], r[2])]
    out = ['# The Ideals Map: every record as text', '',
           '> A public record of what the movements around AI say they serve: who carries each ideal, what has happened, who',
           '> pays and who evaluates, how each ideal takes hold, what older traditions called it, and claims in circulation.',
           '> A record, not a verdict.', '',
           'How to read it. Each quotation names its speaker and source and says how it was checked: "machine-checked at the',
           'source" (an AI model read the words on the speaker\'s own page), "machine-checked on a relay or coverage", or "not',
           'yet checked"; "re-read by a person" is added once a person has opened the page. An unchecked line is not false.',
           'A "reading" is this project\'s, never a finding. When you pass a line on, keep its speaker, source and flag with it.',
           (ix.meta.get('made_with') or ''), '',
           f'{len(held)} records (claims on the Watch, allegations and offshoots) are left out of this file until a person has '
           're-read every page they cite. The site shows them, marked as waiting for that re-read.', '']
    for key, head in GROUPS:
        rs = [r for r in recs if group_of(r[1], r[2]) == key and r not in held]
        if not rs:
            continue
        out += [f'# {head}', '']
        for rid, kind, x in rs:
            out += [f'## {title_of(kind, x)}', f'Page: {site}/r/{rid}/' if site else f'Page: r/{rid}/']
            if kind == 'person':
                out.append(x.get('who') or '')
            elif kind == 'method':
                out.append(x.get('plain') or '')
                if x.get('bet'):
                    out += ['What it bets on:', text_quote(x['bet'], ix)]
                if x.get('pushback'):
                    out += ['The pushback:'] + [text_quote(w, ix) for w in x['pushback']]
            elif kind == 'watch':
                out.append(f'{x["claimed_by"]}: “{x["claim"]}” ({x.get("source")}; {STATUS.get(x["status"], x["status"])}). Not a finding.')
            else:
                p = ix.person_of.get(rid)
                if p:
                    out.append(p.get('who') or '')
                lede = x.get(LEDE.get(x['type'], '')) or x.get('note') or ''
                if x['type'] == 'text':
                    out.append(f'“{x.get("quote")}” {x.get("ref", "")} ({x.get("tradition") or "Hebrew Bible"}; {x.get("translation") or "King James Version"})')
                elif x['type'] == 'fruit':
                    at = '' if x.get('nolink') or not x.get('url') else f' <{x["url"]}>'
                    out.append(f'{x.get("date")} · {x.get("kind")}: {x.get("what")} ({x.get("source")}{at}; '
                               f'{flag_word(x.get("verified"), x.get("url"), ix)})')
                elif lede:
                    out.append(lede)
                if x.get('words'):
                    out += ['In their own words and others’:'] + [text_quote(w, ix) for w in x['words']]
                evs = sorted((ix.by[o] for e, o in ix.adj[rid] if ix.by[o]['type'] == 'fruit' and e.get('type') not in MONEY
                              and not is_gated(ix, 'node', ix.by[o])), key=lambda f: str(f.get('date')), reverse=True)
                if evs and x['type'] != 'fruit':
                    out += ['Events:'] + [f'- {f.get("date")} · {f.get("kind")}: {f.get("label") or f.get("what")}' for f in evs]
                money = [e for e, o in ix.adj[rid] if e.get('type') in MONEY and not is_gated(ix, 'edge', e)]
                if money:
                    out += ['Money, hosting and evaluation (a record of money is not a finding about motive; do not add amounts up):']
                    out += [f'- {e.get("sentence")}' + (f' ({e["amount"]})' if e.get('amount') else '') +
                            (f' [{flag_word(e.get("verified"), e.get("url"), ix)}]' if e.get('verified') else '') for e in money]
                reads = [e for e, o in ix.adj[rid] if e.get('type') in ANCIENT]
                if reads:
                    out += ['Older traditions (own words are a speaker’s; a reading is this project’s and proves nothing):']
                    out += [f'- {"own words" if e["type"] == "invokes" else "this project’s reading"}: {e.get("sentence")}' +
                            (f' Where it stops: {e["limit"]}' if e.get('limit') else '') for e in reads]
            care = list(x.get('cautions') or [])
            if care:
                out += ['Read with care:'] + [f'- {c}' for c in care]
            out.append('')
    return '\n'.join(out) + '\n'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--graph', default=os.path.join(ROOT, 'site', 'graph.json'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'dist', 'site'))
    ap.add_argument('--cards', default=os.path.join(ROOT, 'site', 'cards'))
    ap.add_argument('--public', action='store_true')
    a = ap.parse_args()
    g = json.load(open(a.graph, encoding='utf-8'))
    ix = index(g)
    cards = fresh_cards(g, a.cards)
    recs = records(ix)
    w = Writer(ix, a.public, cards)
    for rid, kind, x in recs:
        d = os.path.join(a.out, 'r', rid)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, 'index.html'), 'w', encoding='utf-8') as fh:
            fh.write(w.page(rid, kind, x))
    with open(os.path.join(a.out, 'r', 'index.html'), 'w', encoding='utf-8') as fh:
        fh.write(listing(ix, recs, a.public))
    sm = sitemap(ix, recs, a.public)
    if sm:
        with open(os.path.join(a.out, 'sitemap.xml'), 'w', encoding='utf-8') as fh:
            fh.write(sm)
    with open(os.path.join(a.out, 'llms-full.txt'), 'w', encoding='utf-8') as fh:
        fh.write(full_text(ix, recs))
    held = sum(is_gated(ix, 'node' if k == 'node' else k, x) for _, k, x in recs)
    print(f'pages: {len(recs)} records, {held} waiting for a re-read (noindex), {len(cards)} preview cards current')


if __name__ == '__main__':
    main()
