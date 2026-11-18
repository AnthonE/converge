#!/usr/bin/env python3
"""Check a draft before it goes into data/: is every quotation really on the page it cites?

  python3 tools/checkdraft.py DRAFT.json                 report each quotation: found, found (punctuation), not found
  python3 tools/checkdraft.py DRAFT.json --out OK.json   also write the draft with every unmatched quotation removed

For drafts written by agents (a researcher, the weekly sweep). It walks the JSON; every object with both a "quote"
and a "url" is checked by fetching that page and looking for the words (tools/precheck.py does the matching,
allowing for elisions and punctuation). A match is a machine check, not a person's reading. With --out, an object
whose quotation was not found is dropped from the list it sits in; if it is not in a list (a method's "bet"), its
quotation is removed and the object is kept, so the gap shows. Pages that refuse the script are reported, not
dropped: someone must read them.
"""
import argparse, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import precheck as P


def quoted(o, path=()):
    if isinstance(o, dict):
        if isinstance(o.get('quote'), str) and isinstance(o.get('url'), str):
            yield path, o
        for k, v in o.items():
            yield from quoted(v, path + (k,))
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from quoted(v, path + (i,))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('draft')
    ap.add_argument('--out')
    ap.add_argument('--timeout', type=float, default=25)
    a = ap.parse_args()
    data = json.load(open(a.draft, encoding='utf-8'))
    items = list(quoted(data))
    pages = {}
    for _, o in items:
        pages.setdefault(o['url'], []).append(o['quote'])
    res = {}
    for url, qs in pages.items():
        res[url] = P.check(url, list(dict.fromkeys(qs)), a.timeout)
    bad, unread = [], []
    for path, o in items:
        r = res[o['url']]
        if r['status'] != 'text':
            unread.append((path, o, r['status']))
            print(f'UNREAD  {r["status"]:8s} {"/".join(map(str, path))}: {o["url"]}')
            continue
        hit = next(q for q in r['quotes'] if q['quote'] == o['quote'])
        mark = 'ok     ' if hit['result'] != 'not found' else 'MISSING'
        print(f'{mark} {hit["result"]:26s} {"/".join(map(str, path))}: {o["quote"][:70]}')
        if hit['result'] == 'not found':
            bad.append((path, o))
    print(f'\n{len(items)} quotations on {len(pages)} pages: {len(items) - len(bad) - len(unread)} found, {len(bad)} not found, {len(unread)} on pages the script could not read')
    if a.out:
        drop = {id(o) for _, o in bad}

        def prune(x):
            if isinstance(x, list):
                return [prune(v) for v in x if not (isinstance(v, dict) and id(v) in drop)]
            if isinstance(x, dict):
                if id(x) in drop:
                    x = {k: v for k, v in x.items() if k != 'quote'}
                return {k: prune(v) for k, v in x.items()}
            return x
        json.dump(prune(data), open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('wrote', a.out)
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
