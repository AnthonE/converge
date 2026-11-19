#!/usr/bin/env python3
"""Package the Ideals Map as a small static site for any host.

  python3 tools/package.py            -> dist/site/ and dist/ideals-map-site.zip (kept out of search engines)
  python3 tools/package.py --public   -> the same, indexable, with the 'private prototype' tag changed to 'draft'
                                                        (or set the environment variable PUBLIC=true)

It validates the data first (build.py; any problem stops it), then copies the viewer and its data. The folder needs
nothing but a static file server: no build step, no database, no server code. The page loads graph.json with fetch,
so open it over http(s), not as a file. A single-file copy for offline reading is dist/ideals-map.html.

Added files:
  _headers     security headers (Netlify and Cloudflare Pages read this file as is; on other hosts, set them yourself)
  robots.txt   keeps crawlers out unless --public
  README.txt   how to deploy
  reread.html  the re-read, on a phone: answers are kept on the phone and saved to the repository as a commit
  feed.xml     an Atom feed of the newest claims on the Watch and events on the map (tools/feed.py)
  r/           every record as a plain page of its own, for search, shared links and AI systems (tools/pages.py)
  sitemap.xml  the pages search engines may index (public copies with site_url only)
  llms-full.txt  the same records as plain text, each quotation with its source and flag
  cards/       the preview images shared links show (tools/cards.py draws them)
"""
import argparse, html as html_mod, json, os, shutil, subprocess, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SITE = os.path.join(ROOT, 'site')
FILES = ['index.html', 'heart.html', 'map.css', 'layout.js', 'render.js', 'money.js', 'watch.js', 'ancients.js', 'guide.js', 'ideals.js', 'people.js', 'record.js', 'methods.js', 'map.js', 'graph.json',
         'reread.html', 'reread.js', 'reread.css']

CSP = ("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; "
       "frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'")

README = """The Ideals Map, as a static site.

Upload everything in this folder to any static host. There is no build step and no server code.
- Netlify or Cloudflare Pages: drag the folder (or the zip) into a new site. They read _headers as is.
- GitHub Pages: put the files in the published branch or folder. GitHub ignores _headers, so the page
  runs without those headers; it still works.
- Any web server (nginx, Caddy, Apache): serve the folder as static files and copy the headers in _headers
  into its config.
Open it over http(s). Opening index.html straight from disk will not load graph.json; for that, use
ideals-map.html (one file, everything inside).

{visibility}

To update: edit data/ (or add Watch entries to data/watch.json), run
  python3 tools/package.py{flag}
and upload the new folder over the old one.
"""


# For AI systems and their users: where the machine-readable record is, and how to read it.
LLMS = """# The Ideals Map

> A public record of what the movements around AI say they serve: who carries each ideal, what has happened, who
> pays and who evaluates, how each ideal takes hold, what older traditions called it, and claims in circulation
> with the evidence for each. A record, not a verdict.

Every quotation and event carries its source and a checking flag. A claim on the Watch is not a finding; an
unchecked claim is not false; a dotted link is the project's reading. The records were gathered and checked with
AI models made by Anthropic, which is itself on the map; data/sources.csv says which cited pages a person has
re-read so far.

## Records

- [Every record as a plain page](r/): one page per ideal, person, group, event, funder, evaluator, method and claim
- [Every record as plain text](llms-full.txt): each quotation with its speaker, source and checking flag. Claims on
  the Watch and allegations are added once a person has re-read their sources.

## Data

- [Guide to every table and field](data/DATA.md)
- [The whole map as one JSON file](data/graph.json)
- [CSV tables, zipped](data/ideals-map-data.zip)
- [Licence: CC BY 4.0 for the data; quoted words belong to their authors](data/LICENSE-DATA.md)
"""


HOME_DESC = ('What the people building and promoting AI say it is for, who says it, what has happened and who pays, with the '
             'source and how it was checked on every line. A record, not a verdict.')
HEART_DESC = ('What the traditions saw, and why it bears on AI: no one sees the heart, and behaviour alone does not certify what '
              'an agent is bound to. The reading of the person who keeps the Ideals Map; texts and builders are quoted in their own words.')


def preview(meta, path, title, desc, img):
    """What a shared link shows, and the page's own address. Absolute addresses need site_url."""
    site = (meta.get('site_url') or '').rstrip('/')
    t = [f'<meta property="og:site_name" content="The Ideals Map">', '<meta property="og:type" content="website">',
         f'<meta property="og:title" content="{html_mod.escape(title)}">', f'<meta property="og:description" content="{html_mod.escape(desc)}">',
         f'<meta name="twitter:card" content="{"summary_large_image" if img else "summary"}">']
    if site:
        t += [f'<link rel="canonical" href="{site}/{path}">', f'<meta property="og:url" content="{site}/{path}">']
        if img:
            t += [f'<meta property="og:image" content="{site}/{img}">', '<meta property="og:image:width" content="1200">',
                  '<meta property="og:image:height" content="630">', f'<meta property="og:image:alt" content="{html_mod.escape(title)}">']
    return '\n'.join(t) + '\n'


def site_ld(meta, updated):
    """What the site is, for search engines, including Dataset Search: the data, its licence and where to get it."""
    site = (meta.get('site_url') or '').rstrip('/')
    if not site:
        return ''
    desc = ('A public record of what the movements around AI say they serve: the ideals, who carries them, events, funders, '
            'AI companies, evaluators, alignment methods, older texts read beside them, and claims in circulation, each '
            'quotation with its source and a flag for how it was checked.')
    d = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'WebSite', 'name': 'The Ideals Map', 'url': site + '/', 'description': desc, 'inLanguage': 'en'},
        {'@type': 'Dataset', 'name': 'The Ideals Map: data', 'description': desc, 'url': site + '/',
         'license': 'https://creativecommons.org/licenses/by/4.0/', 'isAccessibleForFree': True,
         **({'dateModified': updated} if updated else {}),
         'keywords': ['artificial intelligence', 'AI movements', 'AI funding', 'AI evaluation', 'religion and technology',
                      'claims and sources'],
         'distribution': [
             {'@type': 'DataDownload', 'encodingFormat': 'application/json', 'contentUrl': site + '/data/graph.json'},
             {'@type': 'DataDownload', 'encodingFormat': 'application/zip', 'contentUrl': site + '/data/ideals-map-data.zip'}]}]}
    return '<script type="application/ld+json">' + json.dumps(d, ensure_ascii=False).replace('</', '<\\/') + '</script>\n'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--public', action='store_true', help='let search engines index it and drop the "private prototype" tag')
    ap.add_argument('--out', default=os.path.join(ROOT, 'dist', 'site'))
    a = ap.parse_args()
    a.public = a.public or os.environ.get('PUBLIC', '').lower() == 'true'   # hosts with no flags (Vercel): set PUBLIC=true
    # Or say so in the data: "public": true in data/meta.json publishes every build, with no host setting to change.
    a.public = a.public or json.load(open(os.path.join(ROOT, 'data', 'meta.json'), encoding='utf-8')).get('public') is True
    r = subprocess.run([sys.executable, os.path.join(ROOT, 'build.py')], capture_output=True, text=True)
    print(r.stdout.strip().splitlines()[-1] if r.stdout.strip() else '')
    if r.returncode:
        sys.exit(r.stdout + r.stderr)
    if os.path.exists(a.out):
        shutil.rmtree(a.out)
    os.makedirs(a.out)
    for f in FILES:
        shutil.copy(os.path.join(SITE, f), os.path.join(a.out, f))
    shutil.copy(os.path.join(ROOT, 'dist', 'ideals-map.html'), os.path.join(a.out, 'ideals-map.html'))
    index = os.path.join(a.out, 'index.html')
    html = open(index, encoding='utf-8').read()
    # What a shared link shows: the title, a description and a preview image drawn from the data (tools/cards.py).
    g = json.load(open(os.path.join(SITE, 'graph.json'), encoding='utf-8'))
    meta = g.get('meta') or {}
    sys.path.insert(0, HERE)
    import pages
    cards = pages.fresh_cards(g, os.path.join(SITE, 'cards'))
    if cards:
        os.makedirs(os.path.join(a.out, 'cards'))
        for rel in cards.values():
            shutil.copy(os.path.join(SITE, rel), os.path.join(a.out, rel))
    css = '<link rel="stylesheet" href="map.css">'
    html = html.replace(css, preview(meta, '', 'The Ideals Map', HOME_DESC, cards.get('home')) + site_ld(meta, g.get('updated')) + css, 1)
    heart = os.path.join(a.out, 'heart.html')
    text = open(heart, encoding='utf-8').read()   # read before opening for writing, which empties the file
    text = text.replace(css, f'<meta name="description" content="{html_mod.escape(HEART_DESC)}">\n' +
                        preview(meta, 'heart.html', 'The heart · The Ideals Map', HEART_DESC, cards.get('home')) + css, 1)
    with open(heart, 'w', encoding='utf-8') as fh:
        fh.write(text)
    headers = ['/*', f'  Content-Security-Policy: {CSP}', '  X-Content-Type-Options: nosniff', '  Referrer-Policy: no-referrer',
               '  Permissions-Policy: camera=(), microphone=(), geolocation=()']
    if a.public:
        html = html.replace('<meta name="robots" content="noindex, nofollow">\n', '')
        heart = os.path.join(a.out, 'heart.html')
        text = open(heart, encoding='utf-8').read()   # read before opening for writing, which empties the file
        with open(heart, 'w', encoding='utf-8') as fh:
            fh.write(text.replace('<meta name="robots" content="noindex, nofollow">\n', ''))
        html = html.replace('<span class="tag">private prototype</span>', '<span class="tag">draft</span>')
        single = os.path.join(a.out, 'ideals-map.html')
        text = open(single, encoding='utf-8').read()
        with open(single, 'w', encoding='utf-8') as fh:
            fh.write(text.replace('<meta name="robots" content="noindex, nofollow">\n', '').replace('<span class="tag">private prototype</span>', '<span class="tag">draft</span>'))
        robots = 'User-agent: *\nAllow: /\n'
        if meta.get('site_url'):
            robots += f'Sitemap: {meta["site_url"].rstrip("/")}/sitemap.xml\n'
        visibility = 'This copy is public: search engines may index it.'
    else:
        headers.append('  X-Robots-Tag: noindex, nofollow')
        robots = 'User-agent: *\nDisallow: /\n'
        visibility = ('This copy is kept out of search engines (noindex). Anyone with the link can still open it. '
                      'Run with --public when the sources have been re-read by a person and you want it found.')
    open(index, 'w', encoding='utf-8').write(html)
    # The data for researchers: graph.json, CSV tables, DATA.md and a zip, under data/.
    r = subprocess.run([sys.executable, os.path.join(HERE, 'export_data.py'), '--out', os.path.join(a.out, 'data')], capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stdout + r.stderr)
    # The phone re-read page's queue: every cited page, what the map takes from it, and the readings so far.
    r = subprocess.run([sys.executable, os.path.join(HERE, 'phone_queue.py'), '--out', os.path.join(a.out, 'reread-queue.json')], capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stdout + r.stderr)
    # A feed of the newest claims and events, for readers who want to hear of new entries.
    r = subprocess.run([sys.executable, os.path.join(HERE, 'feed.py'), '--graph', os.path.join(SITE, 'graph.json'), '--out', os.path.join(a.out, 'feed.xml')], capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stdout + r.stderr)
    # Every record as a plain page, the sitemap and llms-full.txt (tools/pages.py).
    r = subprocess.run([sys.executable, os.path.join(HERE, 'pages.py'), '--graph', os.path.join(SITE, 'graph.json'), '--out', a.out]
                       + (['--public'] if a.public else []), capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stdout + r.stderr)
    print(r.stdout.strip())
    open(os.path.join(a.out, '_headers'), 'w').write('\n'.join(headers) + '\n')
    open(os.path.join(a.out, 'robots.txt'), 'w').write(robots)
    open(os.path.join(a.out, 'llms.txt'), 'w').write(LLMS)
    open(os.path.join(a.out, 'README.txt'), 'w').write(README.format(visibility=visibility, flag=' --public' if a.public else ''))
    z = os.path.join(os.path.dirname(a.out), 'ideals-map-site.zip')
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as fh:
        for d, _, fs in sorted(os.walk(a.out)):
            for f in sorted(fs):
                fh.write(os.path.join(d, f), os.path.relpath(os.path.join(d, f), a.out))
    print(f'site: {a.out}  ({len(os.listdir(a.out))} files)\nzip:  {z}')


if __name__ == '__main__':
    main()
