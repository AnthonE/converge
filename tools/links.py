#!/usr/bin/env python3
"""Check that every page the map cites still answers. Read-only: it fetches each page once and writes a report.

  python3 tools/links.py                 check all cited pages -> dist/links.json, dist/links.md
  python3 tools/links.py --only dead     print the dead ones from the last report without fetching again

Sources disappear; a record whose source is gone can no longer be checked by anyone. Many sites refuse automated
fetches (403, 429), so 'refused' means only that this script could not tell, not that the page is gone. 'Gone'
means the server said 404 or 410 while its own home page answers, or the name no longer resolves. Some sites
answer 404 to every automated request (ftc.gov does); when the home page is refused too, the page counts as
'refused', not 'gone'.

Archiving: for each page that still answers, the Wayback Machine can keep a copy
(https://web.archive.org/save/<url>). That sends the address to the Internet Archive, so it is left for the
operator to run by hand; this script does not do it.
"""
import argparse, concurrent.futures as cf, datetime, json, os, socket, ssl, sys, threading, urllib.error, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sources as S

OUT = os.path.join(S.ROOT, 'dist')
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 link-check'


_roots = {}
_roots_lock = threading.Lock()


def root_answers(url, timeout):
    """Does the site's home page answer this script? Asked once per host."""
    p = urllib.parse.urlparse(url)
    root = f'{p.scheme}://{p.netloc}/'
    with _roots_lock:
        if root in _roots:
            return _roots[root]
    try:
        req = urllib.request.Request(root, headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=timeout, context=ssl.create_default_context()) as r:
            ok = r.status < 400
    except Exception:
        ok = False
    with _roots_lock:
        _roots[root] = ok
    return ok


def fetch(url, timeout):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,application/pdf,*/*;q=0.8'})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ssl.create_default_context()) as r:
            r.read(2048)
            final = r.geturl()
            return {'status': 'ok', 'code': r.status, 'final': final if final != url else None}
    except urllib.error.HTTPError as e:
        if e.code in (404, 410):
            if root_answers(url, timeout):
                return {'status': 'gone', 'code': e.code}
            return {'status': 'refused', 'code': e.code, 'error': 'the site refuses this script everywhere'}
        return {'status': 'refused', 'code': e.code}
    except urllib.error.URLError as e:
        reason = e.reason
        if isinstance(reason, socket.gaierror) or 'Name or service not known' in str(reason):
            return {'status': 'gone', 'error': 'name does not resolve'}
        return {'status': 'error', 'error': str(reason)[:120]}
    except Exception as e:  # timeouts, TLS, resets
        return {'status': 'error', 'error': (type(e).__name__ + ': ' + str(e))[:120]}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--only', choices=['gone', 'dead', 'refused', 'error'])
    ap.add_argument('--timeout', type=float, default=20)
    ap.add_argument('--workers', type=int, default=12)
    a = ap.parse_args()
    rpt = os.path.join(OUT, 'links.json')
    if a.only:
        want = 'gone' if a.only == 'dead' else a.only
        for url, r in json.load(open(rpt))['pages'].items():
            if r['status'] == want:
                print(url, r.get('code') or r.get('error'))
        return
    pages = S.collect()
    res = {}
    with cf.ThreadPoolExecutor(a.workers) as ex:
        futs = {ex.submit(fetch, u, a.timeout): u for u in pages}
        for f in cf.as_completed(futs):
            res[futs[f]] = f.result()
    for u, r in res.items():
        r['items'] = [f"{x['file']}:{x['owner']}" for x in pages[u]['items']]
    counts = {}
    for r in res.values():
        counts[r['status']] = counts.get(r['status'], 0) + 1
    os.makedirs(OUT, exist_ok=True)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    json.dump({'checked': stamp, 'counts': counts, 'pages': dict(sorted(res.items()))}, open(rpt, 'w'), indent=1)
    md = [f'# Link check, {stamp}', '', ', '.join(f'{k}: {v}' for k, v in sorted(counts.items())), '',
          '`gone` = 404, 410 or the name no longer resolves. `refused` = the site turned away an automated fetch '
          '(the page may be fine). `error` = timeout or connection failure.', '']
    for st in ('gone', 'error', 'refused'):
        rows = sorted(u for u, r in res.items() if r['status'] == st)
        if rows:
            md += [f'## {st} ({len(rows)})', '']
            md += [f"- {u} ({res[u].get('code') or res[u].get('error')}) cited by {', '.join(res[u]['items'][:4])}" for u in rows]
            md.append('')
    moved = sorted(u for u, r in res.items() if r.get('final'))
    if moved:
        md += [f'## redirected ({len(moved)})', ''] + [f'- {u} -> {res[u]["final"]}' for u in moved]
    open(os.path.join(OUT, 'links.md'), 'w').write('\n'.join(md) + '\n')
    print(f'{len(res)} pages: ' + ', '.join(f'{k} {v}' for k, v in sorted(counts.items())) + '. Report: dist/links.md')


if __name__ == '__main__':
    main()
