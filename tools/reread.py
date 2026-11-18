#!/usr/bin/env python3
"""The re-read queue: every page the map cites, in the order a person should read it.

Nothing on the map has been re-read by a person yet; models did every step. This turns that debt into a list
that can be counted and worked down, one page at a time. One reading of a page covers every item that cites it.

  python3 tools/reread.py                      write dist/reread.md and dist/reread.csv, print progress
  python3 tools/reread.py mark URL RESULT      record a reading in data/reread.json
        RESULT: holds | "does not hold" | corrected | removed | "could not read"   [--note TEXT] [--date YYYY-MM-DD]
  python3 tools/review.py                      the same, one page at a time, in a browser

Order: the Watch first (claims about named people), then allegations and court matters, then anything no model
checked, then items a model read only on a relay, then items a model read at the source. Within each, the pages
cited most often come first, because one reading clears the most.

What a reading means: open the page yourself, find the words the map quotes or the fact it states, and record
'holds' if they are there as the map has them. If not, mark 'does not hold' with a note saying what the page
says; whoever fixes the record then marks it 'corrected' (or 'removed'). Run python3 build.py --check after.
"""
import argparse, csv, datetime, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sources as S

OUT = os.path.join(S.ROOT, 'dist')


def queue(pages, done):
    rows = [(u, p) for u, p in pages.items() if u not in done]
    rows.sort(key=lambda r: (r[1]['tier'], -len(r[1]['items']), S.host(r[0]), r[0]))
    return rows


def write(pages, led):
    done = {r['url']: r for r in led if r.get('result') in S.DONE}
    rows = queue(pages, {r["url"] for r in led})   # anything a person has looked at leaves the queue
    os.makedirs(OUT, exist_ok=True)
    total, n = len(pages), len([u for u in pages if u in done])
    items = sum(len(p['items']) for p in pages.values())
    covered = sum(len(p['items']) for u, p in pages.items() if u in done)
    md = ['# Re-read queue', '',
          f'{n} of {total} cited pages re-read by a person, covering {covered} of {items} items on the map.',
          f'Generated {datetime.date.today().isoformat()} by tools/reread.py. Work from the top. Record each reading with',
          '`python3 tools/reread.py mark URL holds` (or corrected / removed / "could not read").', '']
    tier = None
    for i, (url, p) in enumerate(rows, 1):
        if p['tier'] != tier:
            tier = p['tier']
            left = sum(1 for _, q in rows if q['tier'] == tier)
            md += ['', f'## {tier}. {S.TIERS[tier]} ({left} pages)', '']
        md.append(f'- [ ] **{i}.** {url}  ')
        md.append(f'  {S.host(url)} · cited by {len(p["items"])} item(s)' + (' · named on the map, never linked' if any(x['nolink'] for x in p['items']) else ''))
        for x in p['items'][:6]:
            text = x['text'].replace('\n', ' ')
            text = text if len(text) <= 180 else text[:177] + '...'
            md.append(f'  - `{x["file"]}:{x["owner"]}` ({x["where"]}, flag: {x["flag"]}): {text}')
        if len(p['items']) > 6:
            md.append(f'  - and {len(p["items"]) - 6} more')
    bad = [r for r in led if r.get('result') == 'does not hold']
    if bad:
        md += ['', '## Pages that do not hold: fix these records', ''] + [f'- {r["url"]} ({r.get("date", "")}) {r.get("note", "")}' for r in bad]
    unread = [r for r in led if r.get('result') == 'could not read']
    if unread:
        md += ['', '## Pages a person could not read', ''] + [f'- {r["url"]} ({r.get("date", "")}) {r.get("note", "")}' for r in unread]
    open(os.path.join(OUT, 'reread.md'), 'w', encoding='utf-8').write('\n'.join(md) + '\n')
    with open(os.path.join(OUT, 'reread.csv'), 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh)
        w.writerow(['order', 'tier', 'tier_name', 'url', 'host', 'items', 'files', 'flags'])
        for i, (url, p) in enumerate(rows, 1):
            w.writerow([i, p['tier'], S.TIERS[p['tier']], url, S.host(url), len(p['items']),
                        ' '.join(sorted({x['file'] for x in p['items']})), ' '.join(sorted({x['flag'] for x in p['items']}))])
    print(f'{n} of {total} pages re-read ({covered} of {items} items). Queue: dist/reread.md, dist/reread.csv')
    if bad:
        print(f'  {len(bad)} page(s) marked "does not hold": their records need fixing (listed in dist/reread.md)')
    for t in S.TIERS:
        k = sum(1 for _, q in rows if q['tier'] == t)
        if k:
            print(f'  tier {t}: {k:3d} pages left  ({S.TIERS[t]})')


def mark(pages, led, url, result, note, date):
    if url not in pages:
        sys.exit(f'not cited anywhere in data/: {url}')
    if result not in S.RESULTS:
        sys.exit(f'result must be one of: {", ".join(S.RESULTS)}')
    led = [r for r in led if r['url'] != url]
    rec = {'url': url, 'date': date, 'result': result}
    if note:
        rec['note'] = note
    led.append(rec)
    led.sort(key=lambda r: (r['date'], r['url']))
    with open(os.path.join(S.DATA, 'reread.json'), 'w', encoding='utf-8') as fh:
        json.dump(led, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    print(f'recorded: {result} ({S.RESULTS[result]}) for {url}')
    return led


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cmd', nargs='?', choices=['mark'])
    ap.add_argument('url', nargs='?')
    ap.add_argument('result', nargs='?')
    ap.add_argument('--note', default='')
    ap.add_argument('--date', default=datetime.date.today().isoformat())
    a = ap.parse_args()
    pages, led = S.collect(), S.ledger()
    if a.cmd == 'mark':
        if not a.url or not a.result:
            ap.error('mark needs a URL and a result')
        led = mark(pages, led, a.url, a.result, a.note, a.date)
    write(pages, led)


if __name__ == '__main__':
    main()
