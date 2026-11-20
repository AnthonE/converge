#!/usr/bin/env python3
"""Check the plain record pages (tools/pages.py) on the fixture.

  python3 test/make_fixture.py && python3 build.py --data test/fixture --no-site --out dist/fixture.html \
    && python3 test/pages.py dist/fixture.html

Every record gets a page; a page that waits for a person's re-read is noindex and left out of the sitemap and of
llms-full.txt; data is escaped, never inserted as markup; the only script is citation markup that parses; every
party's page invites a reply. Needs only Python.
"""
import json, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import pages  # noqa: E402

fails = []


def fail(msg):
    fails.append(msg)


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', 'fixture.html')
    m = re.search(r'<script type="application/json" id="graph-data">(.*?)</script>', open(src, encoding='utf-8').read(), re.S)
    g = json.loads(m.group(1))
    tmp = tempfile.mkdtemp()
    try:
        json.dump(g, open(os.path.join(tmp, 'graph.json'), 'w'))
        out = os.path.join(tmp, 'site')
        r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'pages.py'), '--graph', os.path.join(tmp, 'graph.json'),
                            '--out', out, '--cards', os.path.join(tmp, 'none'), '--public'], capture_output=True, text=True)
        if r.returncode:
            sys.exit(r.stdout + r.stderr)
        check(g, out)
    finally:
        shutil.rmtree(tmp)
    if fails:
        print('FAIL')
        for f in fails:
            print(' -', f)
        sys.exit(1)
    print(f'PASS: plain pages for {len(pages.records(pages.index(g)))} records')


def check(g, out):
    ix = pages.index(g)
    recs = pages.records(ix)
    sitemap = open(os.path.join(out, 'sitemap.xml'), encoding='utf-8').read()
    full = open(os.path.join(out, 'llms-full.txt'), encoding='utf-8').read()
    listing = open(os.path.join(out, 'r', 'index.html'), encoding='utf-8').read()
    site = g['meta']['site_url'].rstrip('/')
    held = 0
    for rid, kind, x in recs:
        path = os.path.join(out, 'r', rid, 'index.html')
        if not os.path.exists(path):
            fail(f'{rid}: no page')
            continue
        page = open(path, encoding='utf-8').read()
        gated = pages.is_gated(ix, 'node' if kind == 'node' else kind, x)
        held += gated
        url = f'{site}/r/{rid}/'
        if gated:
            if '<meta name="robots" content="noindex">' not in page:
                fail(f'{rid}: waits for a re-read but search engines may index it')
            if url in sitemap:
                fail(f'{rid}: waits for a re-read but is in the sitemap')
            if f'Page: {url}' in full:
                fail(f'{rid}: waits for a re-read but is in llms-full.txt')
            if 'data-nosnippet' not in page or 'search engines are asked not to index this page' not in page:
                fail(f'{rid}: does not say it waits for a re-read')
            if f'href="{rid}/" rel="nofollow"' not in listing:
                fail(f'{rid}: the list of every record links it without nofollow')
        else:
            if 'name="robots"' in page:
                fail(f'{rid}: kept out of search engines though nothing gates it')
            if f'<loc>{url}</loc>' not in sitemap:
                fail(f'{rid}: missing from the sitemap')
            if f'Page: {url}' not in full:
                fail(f'{rid}: missing from llms-full.txt')
        if f'<link rel="canonical" href="{url}">' not in page:
            fail(f'{rid}: no canonical address')
        if not re.search(r'<meta name="description" content="[^"]{20,}">', page):
            fail(f'{rid}: no description for a shared link')
        if '<b>sample</b>' in page or '<i>Outlet</i>' in page:
            fail(f'{rid}: data was inserted as markup')
        scripts = re.findall(r'<script([^>]*)>(.*?)</script>', page, re.S)
        for attrs, body in scripts:
            if 'application/ld+json' not in attrs:
                fail(f'{rid}: carries a script other than citation markup')
                continue
            try:
                d = json.loads(body)
            except ValueError:
                fail(f'{rid}: its citation markup is not JSON')
                continue
            if 'ClaimReview' in body or 'reviewRating' in body:
                fail(f'{rid}: its markup rates a claim; the map gives no verdicts')
            if d.get('@type') != 'WebPage':
                fail(f'{rid}: its markup is not a WebPage')
        if gated and scripts:
            fail(f'{rid}: waits for a re-read but carries citation markup')
        party = kind != 'node' or x['type'] not in ('text', 'pattern', 'mechanism')
        has_reply = 'template=reply.yml' in page
        if party != has_reply:
            fail(f'{rid}: {"no reply invitation" if party else "a reply invitation on a text, pattern or mechanism"}')
        if 'template=correction.yml' not in page:
            fail(f'{rid}: no way to correct it')
        has_money = kind == 'node' and any(e.get('type') in pages.MONEY for e, _ in ix.adj.get(rid, []))
        if (kind == 'person' or (kind == 'node' and x['type'] in ('lab', 'funder', 'evaluator'))) and has_money and 'class="glance"' not in page:
            fail(f'{rid}: a person or body with money records has nothing at a glance')
        if kind == 'node' and x['type'] in ('text', 'pattern', 'mechanism', 'fruit') and 'class="glance"' in page:
            fail(f'{rid}: a {x["type"]} page carries a glance meant for people and bodies')
        if f'href="{rid}/"' not in listing:
            fail(f'{rid}: not in the list of every record')
    if not held:
        fail('the fixture has nothing waiting for a re-read, so the gate is untested')
    # Words you'll meet: a page that uses a word ends with its note; a record does not list the word it explains; the list
    # of words is a page of its own, in the sitemap, and in llms-full.txt; a note is text, never markup.
    words = g.get('words') or []
    if words:
        wp = os.path.join(out, 'words', 'index.html')
        if not os.path.exists(wp):
            fail('no words/ page')
        else:
            page = open(wp, encoding='utf-8').read()
            if any(f'id="word-{w["id"]}"' not in page for w in words):
                fail('the words/ page does not list every word')
            if '<i>term</i>' in page:
                fail('a word\'s note was inserted as markup')
        if f'<loc>{site}/words/</loc>' not in sitemap:
            fail('the words/ page is missing from the sitemap')
        if '# Words you’ll meet' not in full or any(f'## {w["word"]}' not in full for w in words):
            fail('llms-full.txt does not carry the words')
        for w in words:
            used = [rid for rid, kind, x in recs if f'id="word-{w["id"]}"' in open(os.path.join(out, 'r', rid, 'index.html'), encoding='utf-8').read()]
            if not used:
                fail(f'{w["id"]}: no record page lists the word, though the fixture uses it')
            named = w.get('see') in ix.by and any(m.lower() in pages.name(ix.by[w['see']]).lower() for m in w.get('match') or [w['word']])
            if named and w['see'] in used:
                fail(f'{w["id"]}: the record it points to, whose title names it, lists it as a word on its own page')
    # Once a person has re-read every page a claim cites, the gate lifts.
    w = (g.get('watch') or [None])[0]
    if w:
        done = [{'url': s['url'], 'date': '2026-11-19', 'result': 'holds'} for s in pages.own_sources(w)]
        if pages.is_gated(pages.index(dict(g, reread=(g.get('reread') or []) + done)), 'watch', w):
            fail('a claim whose every page was re-read still waits for a re-read')
    # The description is the record's own words: an ideal's names its lead voice, a Watch claim says it is not a finding.
    w = (g.get('watch') or [None])[0]
    if w and 'A claim on the Watch is not a finding.' not in pages.describe(ix, w['id'], 'watch', w):
        fail('a Watch claim\'s description does not say a claim is not a finding')
    # A preview card is used only while its words match the data.
    t = pages.card_text(g, 'home')
    if pages.card_hash(t) != pages.card_hash(dict(t)) or pages.card_hash(t) == pages.card_hash(dict(t, title='x')):
        fail('a card\'s hash does not follow its words')


if __name__ == '__main__':
    main()
