#!/usr/bin/env python3
"""Package the Ideals Map as a small static site for any host.

  python3 ops/ideals-map/tools/package.py            -> dist/site/ and dist/ideals-map-site.zip (kept out of search engines)
  python3 ops/ideals-map/tools/package.py --public   -> the same, indexable, with the 'private prototype' tag changed to 'draft'
                                                        (or set the environment variable PUBLIC=true)

It validates the data first (build.py; any problem stops it), then copies the viewer and its data. The folder needs
nothing but a static file server: no build step, no database, no server code. The page loads graph.json with fetch,
so open it over http(s), not as a file. A single-file copy for offline reading is dist/ideals-map.html.

Added files:
  _headers     security headers (Netlify and Cloudflare Pages read this file as is; on other hosts, set them yourself)
  robots.txt   keeps crawlers out unless --public
  README.txt   how to deploy
"""
import argparse, os, shutil, subprocess, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SITE = os.path.join(ROOT, 'site')
FILES = ['index.html', 'map.css', 'layout.js', 'render.js', 'money.js', 'watch.js', 'ancients.js', 'map.js', 'graph.json']

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

To update: edit ops/ideals-map/data/ (or add Watch entries to data/watch.json), run
  python3 ops/ideals-map/tools/package.py{flag}
and upload the new folder over the old one.
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--public', action='store_true', help='let search engines index it and drop the "private prototype" tag')
    ap.add_argument('--out', default=os.path.join(ROOT, 'dist', 'site'))
    a = ap.parse_args()
    a.public = a.public or os.environ.get('PUBLIC', '').lower() == 'true'   # hosts with no flags (Vercel): set PUBLIC=true
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
        html = html.replace('<span class="tag">private prototype</span>', '<span class="tag">draft</span>')
        robots = 'User-agent: *\nAllow: /\n'
        visibility = 'This copy is public: search engines may index it.'
    else:
        headers.append('  X-Robots-Tag: noindex, nofollow')
        robots = 'User-agent: *\nDisallow: /\n'
        visibility = ('This copy is kept out of search engines (noindex). Anyone with the link can still open it. '
                      'Run with --public when the sources have been re-read by a person and you want it found.')
    open(index, 'w', encoding='utf-8').write(html)
    open(os.path.join(a.out, '_headers'), 'w').write('\n'.join(headers) + '\n')
    open(os.path.join(a.out, 'robots.txt'), 'w').write(robots)
    open(os.path.join(a.out, 'README.txt'), 'w').write(README.format(visibility=visibility, flag=' --public' if a.public else ''))
    z = os.path.join(os.path.dirname(a.out), 'ideals-map-site.zip')
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as fh:
        for f in sorted(os.listdir(a.out)):
            fh.write(os.path.join(a.out, f), f)
    print(f'site: {a.out}  ({len(os.listdir(a.out))} files)\nzip:  {z}')


if __name__ == '__main__':
    main()
