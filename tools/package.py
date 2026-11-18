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
"""
import argparse, json, os, shutil, subprocess, sys, zipfile

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

## Data

- [Guide to every table and field](data/DATA.md)
- [The whole map as one JSON file](data/graph.json)
- [CSV tables, zipped](data/ideals-map-data.zip)
- [Licence: CC BY 4.0 for the data; quoted words belong to their authors](data/LICENSE-DATA.md)
"""


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
