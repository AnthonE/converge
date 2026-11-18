#!/usr/bin/env python3
"""The re-read, one page at a time, in a browser.

  python3 tools/review.py               then open http://127.0.0.1:8777
  python3 tools/review.py --port 9000   (--host 0.0.0.0 only on a machine you trust; it has no login)

It shows the next cited page in the queue (the Watch first), what the map takes from it, and what the automatic
pre-check found (run python3 tools/precheck.py first for that; without it the page still works). Open the page,
compare, press a button: the reading goes straight into data/reread.json, the same file that
`tools/reread.py mark` writes. Commit that file to keep the readings.

It runs on this machine only and serves nothing from the public site. Writes need a custom header that a page on
another site cannot send without asking first, so another tab cannot mark pages for you.
"""
import argparse, datetime, json, os, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sources as S

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(S.ROOT, 'dist')
GATE = 2   # tiers 1 and 2 (the Watch, allegations) are read before anything goes public


def state():
    pages, led = S.collect(), {r['url']: r for r in S.ledger()}
    pre = _load(os.path.join(DIST, 'precheck.json'))
    links = _load(os.path.join(DIST, 'links.json'))
    order = sorted(pages.items(), key=lambda kv: (kv[1]['tier'], -len(kv[1]['items']), S.host(kv[0]), kv[0]))
    out = []
    for url, p in order:
        out.append({'url': url, 'host': S.host(url), 'tier': p['tier'], 'tier_name': S.TIERS[p['tier']],
                    'items': p['items'], 'reread': led.get(url), 'precheck': pre.get('pages', {}).get(url),
                    'link': links.get('pages', {}).get(url)})
    done = lambda rows: sum(1 for r in rows if r['reread'] and r['reread']['result'] in S.DONE)
    gate = [r for r in out if r['tier'] <= GATE]
    return {'pages': out, 'tiers': S.TIERS, 'results': S.RESULTS, 'precheck_at': pre.get('checked'),
            'counts': {'total': len(out), 'done': done(out), 'gate_total': len(gate), 'gate_done': done(gate),
                       'flagged': sum(1 for r in out if r['reread'] and r['reread']['result'] == 'does not hold')}}


def _load(fp):
    try:
        return json.load(open(fp, encoding='utf-8'))
    except (OSError, ValueError):
        return {}


def write_ledger(led):
    led.sort(key=lambda r: (r['date'], r['url']))
    tmp = os.path.join(S.DATA, 'reread.json.tmp')
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(led, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    os.replace(tmp, os.path.join(S.DATA, 'reread.json'))


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype='application/json; charset=utf-8'):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path in ('/', '/index.html'):
            return self._send(200, open(os.path.join(HERE, 'review.html'), 'rb').read(), 'text/html; charset=utf-8')
        if self.path == '/api/state':
            return self._send(200, state())
        self._send(404, {'error': 'not found'})

    def do_POST(self):
        if self.headers.get('X-Review') != '1' or 'application/json' not in (self.headers.get('Content-Type') or ''):
            return self._send(403, {'error': 'missing header'})
        try:
            body = json.loads(self.rfile.read(min(int(self.headers.get('Content-Length') or 0), 100_000)) or b'{}')
        except ValueError:
            return self._send(400, {'error': 'bad json'})
        url = body.get('url')
        if url not in S.collect():
            return self._send(400, {'error': 'that page is not cited on the map'})
        led = [r for r in S.ledger() if r['url'] != url]
        if self.path == '/api/mark':
            result, note = body.get('result'), str(body.get('note') or '').strip()[:1000]
            if result not in S.RESULTS:
                return self._send(400, {'error': 'unknown result'})
            if result == 'does not hold' and not note:
                return self._send(400, {'error': 'say what the page says instead'})
            rec = {'url': url, 'date': datetime.date.today().isoformat(), 'result': result}
            if note:
                rec['note'] = note
            led.append(rec)
        elif self.path != '/api/undo':
            return self._send(404, {'error': 'not found'})
        write_ledger(led)
        self._send(200, state())

    def log_message(self, fmt, *args):
        if self.command == 'POST':
            sys.stderr.write('%s %s\n' % (self.command, self.path))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--port', type=int, default=8777)
    a = ap.parse_args()
    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    s = state()['counts']
    print(f'Re-read: {s["done"]} of {s["total"]} pages done; before going public: {s["gate_done"]} of {s["gate_total"]}.')
    print(f'Open http://{a.host}:{a.port}  (Ctrl-C to stop; readings are saved to data/reread.json as you go)')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
