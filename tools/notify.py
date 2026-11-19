#!/usr/bin/env python3
"""Draft a note to each person and body on the map, pointing to their page and inviting a reply. Sends nothing.

  python3 build.py && python3 tools/notify.py        -> dist/notify.md

One entry per public figure, group, company, funder and evaluator with a page, those that claims on the Watch
touch first: the page's address, what it holds, and a short note to adapt and send, or not. Contact addresses are
not in the data; finding them, and deciding whom to write to, is the person who keeps the map's call. Every note
carries the disclosure from data/meta.json, because a body being told it is on the map should know the author's
ties to bodies like it. dist/ is not published.
"""
import argparse, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import pages  # noqa: E402

ORDER = {'lab': 0, 'evaluator': 1, 'funder': 2, 'carrier': 3, 'offshoot': 4, 'person': 5}

NOTE = (
    'Subject: {name} on the Ideals Map: your reply is welcome\n\n'
    'Hello,\n\n'
    'The Ideals Map is a public record of what the movements around AI say they serve. It has a page on {name}:\n{url}\n\n'
    'The page holds {holds}, each with its source and a note of how it was checked. {watch}'
    'It labels no one and gives no verdicts.\n\n'
    'The map was gathered with AI models made by Anthropic and published as a draft on 18 November 2026, before a person '
    'had re-read every source; that re-read is under way. If anything on the page is wrong, out of date or missing your '
    'side, your reply goes on the record beside it, in your own words and under your name:\n{reply}\n\n'
    '[your name]\n\n'
    'Disclosure: {disclosure}\n')


def plural(n, word):
    return f'{n} {word}{"" if n == 1 else "s"}'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--graph', default=os.path.join(ROOT, 'site', 'graph.json'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'dist', 'notify.md'))
    a = ap.parse_args()
    g = json.load(open(a.graph, encoding='utf-8'))
    ix = pages.index(g)
    meta = ix.meta
    site = (meta.get('site_url') or '').rstrip('/')
    w = pages.Writer(ix, True, {})
    rows = []
    for rid, kind, x in pages.records(ix):
        k = x['type'] if kind == 'node' else kind
        if k not in ORDER or (k == 'carrier' and (x.get('historical') or x.get('kind') in ('discourse', 'venue'))):
            continue
        title = pages.title_of(kind, x)
        q = len(x.get('words') or []) if kind == 'node' else 0
        ev = sum(1 for e, o in ix.adj.get(rid, []) if ix.by[o]['type'] == 'fruit') if kind == 'node' else 0
        money = sum(1 for e, o in ix.adj.get(rid, []) if e.get('type') in pages.MONEY) if kind == 'node' else 0
        claims = [c for c in ix.watch.values() if rid in (c.get('touches') or [])]
        holds = ', '.join(s for s in [plural(q, 'quoted passage') if q else '', plural(ev, 'event') if ev else '',
                                      plural(money, 'record') + ' of money, hosting or evaluation' if money else ''] if s)
        holds = holds or 'what the map records about it'
        watch = (f'Its Watch, a list of claims in circulation, has {plural(len(claims), "claim")} that touch you, each '
                 'with what has and has not been checked; a claim on the Watch is not a finding. ') if claims else ''
        url = f'{site}/r/{rid}/' if site else f'r/{rid}/'
        note = NOTE.format(name=title, url=url, holds=holds, watch=watch, reply=w.reply_url(rid, title, 'reply.yml'),
                           disclosure=meta.get('disclosure') or '')
        rows.append((not claims, ORDER[k], title.lower(), title, k, url, claims, note))
    rows.sort()
    out = ['# Notes to the people and bodies on the map', '',
           f'{len(rows)} drafts. Nothing has been sent. Those that claims on the Watch touch come first. Find a public '
           'contact address for each before sending, and adapt or drop any note.', '',
           '**Before sending any:** the disclosure in data/meta.json says no outreach to bodies on the map has been sent. '
           'Once a note goes out, update it to say so (CLAUDE.md, Conflicts), and the notes after it will carry the new wording.', '']
    for _, _, _, title, k, url, claims, note in rows:
        out += [f'## {title} ({k})', '', f'Page: {url}']
        if claims:
            out.append('Claims on the Watch: ' + '; '.join(c['title'] for c in claims))
        out += ['', '```', note.rstrip(), '```', '']
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(out) + '\n')
    print(f'notify: {len(rows)} drafts in {os.path.relpath(a.out, ROOT)} (nothing sent)')


if __name__ == '__main__':
    main()
