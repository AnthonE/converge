#!/usr/bin/env python3
"""Write an Atom feed of the newest claims on the Watch and events on the map.

  python3 tools/feed.py                  -> dist/feed.xml, from site/graph.json (run build.py first)
  python3 tools/feed.py --out PATH       -> PATH

tools/package.py calls it, so a published copy carries feed.xml beside index.html. Each entry links to the claim
or the record in the viewer. Links are absolute when meta.json gives the site's address as "site_url"; otherwise
they are relative to the feed, which feed readers resolve against the feed's own address.
"""
import argparse, json, os, re
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEWEST = 50
STATUS = {'not checked': 'Not yet checked', 'partly checked': 'Partly checked',
          'checked': 'Checked: the sources say what the claim says', 'not supported': 'Checked: the sources read do not support it',
          'source not found': 'No primary source found yet'}


def stamp(date):
    """A record's date as an Atom timestamp. A month or a year alone is read as its first day."""
    m = re.match(r'^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?', str(date or ''))
    if not m:
        return None
    return f'{m.group(1)}-{m.group(2) or "01"}-{m.group(3) or "01"}T00:00:00Z'


def entries(g):
    out = []
    for w in g.get('watch') or []:
        s = stamp(w.get('date'))
        if s:
            summary = f'A claim on the Watch ({STATUS.get(w.get("status"), w.get("status"))}; {w.get("kind")}). ' \
                      f'{w.get("claimed_by")}: “{w.get("claim")}” Source: {w.get("source")}. A claim is not a finding.'
            out.append((s, 'watch', w['id'], w['title'], summary, '#watch/' + w['id']))
    for f in g.get('fruits') or []:
        s = stamp(f.get('date'))
        if s:
            what = f.get('what') or ''
            summary = f'An event on the map ({f.get("kind")}). {what} Source: {f.get("source") or "see the record"}.'
            out.append((s, 'event', f['id'], f.get('label') or what, summary, '#r/' + f['id']))
    out.sort(key=lambda e: (e[0], e[2]), reverse=True)
    return out[:NEWEST]


def feed(g):
    meta = g.get('meta') or {}
    base = (meta.get('site_url') or '').rstrip('/')
    home = base + '/' if base else './'
    updated = stamp(g.get('updated')) or (entries(g)[0][0] if entries(g) else '1970-01-01T00:00:00Z')
    title = meta.get('title') or 'The Ideals Map'
    lines = ['<?xml version="1.0" encoding="utf-8"?>',
             '<feed xmlns="http://www.w3.org/2005/Atom">',
             f'  <title>{escape(title)}: new claims and events</title>',
             '  <subtitle>Claims in circulation about AI and events on the map, each with its source and how far it is checked. '
             'A record, not a verdict.</subtitle>',
             f'  <id>{escape(base + "/feed.xml" if base else "urn:ideals-map:feed")}</id>',
             f'  <link rel="alternate" type="text/html" href="{escape(home)}"/>',
             f'  <link rel="self" type="application/atom+xml" href="{escape(home + "feed.xml")}"/>',
             f'  <updated>{updated}</updated>',
             f'  <author><name>{escape(title)}</name></author>']
    for s, kind, rid, name, summary, frag in entries(g):
        link = home + frag
        rec_id = base + '/' + frag if base else f'urn:ideals-map:{kind}:{rid}'
        lines += ['  <entry>',
                  f'    <title>{escape(name)}</title>',
                  f'    <id>{escape(rec_id)}</id>',
                  f'    <link rel="alternate" type="text/html" href="{escape(link)}"/>',
                  f'    <updated>{s}</updated>',
                  f'    <category term="{kind}"/>',
                  f'    <summary>{escape(summary)}</summary>',
                  '  </entry>']
    lines.append('</feed>')
    return '\n'.join(lines) + '\n'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--graph', default=os.path.join(ROOT, 'site', 'graph.json'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'dist', 'feed.xml'))
    a = ap.parse_args()
    g = json.load(open(a.graph, encoding='utf-8'))
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w', encoding='utf-8') as fh:
        fh.write(feed(g))
    print('wrote', os.path.relpath(a.out, ROOT), f'({len(entries(g))} entries)')


if __name__ == '__main__':
    main()
