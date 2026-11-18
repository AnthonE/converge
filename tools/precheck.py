#!/usr/bin/env python3
"""Look for the map's quoted words on each cited page, automatically, before a person reads it.

  python3 tools/precheck.py              fetch every page that has quoted words -> dist/precheck.json
  python3 tools/precheck.py --all        fetch every cited page, quoted words or not

A match is not a reading. It cannot tell whether the words are in context, whether the page is the speaker's
own, or whether a statement without quotation marks is true. It only sorts the queue: where every quoted word
was found, the person's reading is a quick look at the context; where something was not found, it is a careful
one. It never writes to data/reread.json.

Results per quotation: 'found' (the words, with spelling and order as given), 'found, punctuation differs',
'not found'. Per page: 'text' (read), or why not: 'refused' (the site turned the script away), 'gone',
'error', 'no text' (the page builds itself with scripts, as X does, or is too short to judge).
"""
import argparse, concurrent.futures as cf, datetime, json, os, re, shutil, ssl, subprocess, sys, tempfile, unicodedata
import urllib.error, urllib.request
from html.parser import HTMLParser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sources as S
from links import UA

OUT = os.path.join(S.ROOT, 'dist', 'precheck.json')
SWAP = {'‘': "'", '’': "'", '‚': "'", '‛': "'", '“': '"', '”': '"', '„': '"',
        '–': '-', '—': '-', '−': '-', ' ': ' ', '…': '...'}


class _Text(HTMLParser):
    SKIP = {'script', 'style', 'noscript', 'svg', 'template'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        elif tag in ('p', 'br', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'tr'):
            self.out.append(' ')

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.out.append(data)


def page_text(body, ctype):
    if 'pdf' in ctype or body[:5] == b'%PDF-':
        with tempfile.NamedTemporaryFile(suffix='.pdf') as fh:
            fh.write(body)
            fh.flush()
            if shutil.which('pdftotext'):
                r = subprocess.run(['pdftotext', '-q', fh.name, '-'], capture_output=True)
                return r.stdout.decode('utf-8', 'replace')
            try:
                import pypdf
                return ' '.join((p.extract_text() or '') for p in pypdf.PdfReader(fh.name).pages)
            except Exception:
                return ''
    m = re.search(r'charset=([\w-]+)', ctype)
    html = body.decode(m.group(1) if m else 'utf-8', 'replace')
    p = _Text()
    p.feed(html)
    return ''.join(p.out)


def norm(text, loose=False):
    """Normalise for matching, keeping a map from each output character back to the original text."""
    out, idx, space = [], [], True
    for i, ch in enumerate(text):
        for c in unicodedata.normalize('NFKC', SWAP.get(ch, ch)).lower():
            if loose and not c.isalnum():
                c = ' '
            if c.isspace():
                if space:
                    continue
                c, space = ' ', True
            else:
                space = False
            out.append(c)
            idx.append(i)
    return ''.join(out), idx


def pieces(quote):
    """A quotation may elide ('...', '[...]') or insert ('[the company]'): each piece between must be on the page."""
    parts = re.split(r'\[[^\]]*\]|\.\.\.|…', quote)
    return [p.strip(' ,;:') for p in parts if len(p.strip(' ,;:').split()) >= 2] or [quote]


def match(quote, text, t_exact, t_loose):
    ctx = None
    for loose in (False, True):
        hay, idx = t_loose if loose else t_exact
        ok = True
        for part in pieces(quote):
            needle = norm(part, loose)[0].strip()
            at = hay.find(needle) if needle else -1
            if at < 0:
                ok = False
                break
            if ctx is None:
                a, b = idx[at], idx[min(at + len(needle), len(idx) - 1)]
                ctx = re.sub(r'\s+', ' ', text[max(0, a - 140):b + 140]).strip()
        if ok:
            return ('found, punctuation differs' if loose else 'found'), ctx
        ctx = None
    return 'not found', None


def check(url, quotes, timeout):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,application/pdf,*/*;q=0.8'})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ssl.create_default_context()) as r:
            body, ctype = r.read(12_000_000), r.headers.get('Content-Type', '')
    except urllib.error.HTTPError as e:
        return {'status': 'gone' if e.code in (404, 410) else 'refused', 'code': e.code}
    except Exception as e:
        return {'status': 'error', 'error': (type(e).__name__ + ': ' + str(e))[:120]}
    text = page_text(body, ctype)
    if len(text.split()) < 80:
        return {'status': 'no text', 'words': len(text.split())}
    te, tl = norm(text), norm(text, loose=True)
    res = []
    for q in quotes:
        result, ctx = match(q, text, te, tl)
        res.append({'quote': q, 'result': result, 'context': ctx})
    return {'status': 'text', 'words': len(text.split()), 'quotes': res}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--timeout', type=float, default=25)
    ap.add_argument('--workers', type=int, default=10)
    a = ap.parse_args()
    pages = S.collect()
    todo = {}
    for url, p in pages.items():
        qs = list(dict.fromkeys(q for x in p['items'] for q in x['quotes']))
        if qs or a.all:
            todo[url] = qs
    res = {}
    with cf.ThreadPoolExecutor(a.workers) as ex:
        futs = {ex.submit(check, u, q, a.timeout): u for u, q in todo.items()}
        for f in cf.as_completed(futs):
            res[futs[f]] = f.result()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    json.dump({'checked': stamp, 'pages': dict(sorted(res.items()))}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    st, qr = {}, {}
    for r in res.values():
        st[r['status']] = st.get(r['status'], 0) + 1
        for q in r.get('quotes', []):
            qr[q['result']] = qr.get(q['result'], 0) + 1
    allfound = sum(1 for r in res.values() if r.get('quotes') and all(q['result'] != 'not found' for q in r['quotes']))
    print(f'{len(res)} pages fetched: ' + ', '.join(f'{k} {v}' for k, v in sorted(st.items())))
    print('quotations: ' + ', '.join(f'{k} {v}' for k, v in sorted(qr.items())))
    print(f'{allfound} pages have every quoted word found. Report: dist/precheck.json')


if __name__ == '__main__':
    main()
