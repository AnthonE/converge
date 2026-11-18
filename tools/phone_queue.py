#!/usr/bin/env python3
"""Write the queue that the phone re-read page (site/reread.html) works through.

  python3 tools/phone_queue.py                 -> site/reread-queue.json (for a local look; not committed)
  python3 tools/phone_queue.py --out PATH      -> PATH (tools/package.py writes it into the published site)

Every cited page, in the order to read it (the Watch first, then allegations: the pages to read before going public),
with what the map takes from it, the reading already recorded (data/reread.json and data/reread-inbox/), and the
last automatic pre-check (data/precheck.json, or dist/precheck.json when newer). It also names the repository the
page saves readings to (meta.json "repo"), so a reading made on a phone becomes one commit on GitHub.
"""
import argparse, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sources as S  # noqa: E402

GATE = 2
WORD = {'watch': 'On the Watch', 'offshoots': 'Offshoot', 'ideals': 'Ideal', 'fruits': 'Event', 'carriers': 'Carrier',
        'vehicles': 'Vehicle', 'edges': 'A link', 'funders': 'Funder', 'labs': 'AI company', 'evaluators': 'Evaluator',
        'mechanisms': 'How it takes hold', 'patterns': 'Ancient pattern', 'people': 'Who’s who', 'methods': 'Alignment method'}


def _labels(data_dir):
    out = {}
    for f in S.FILES + ['texts']:
        fp = os.path.join(data_dir, f + '.json')
        if os.path.exists(fp):
            for r in json.load(open(fp, encoding='utf-8')):
                if isinstance(r, dict) and r.get('id'):
                    out[r['id']] = r.get('label') or r.get('title') or r.get('name') or r.get('ref') or r.get('what') or r['id']
    return out


def _precheck(data_dir):
    best = {}
    for fp in (os.path.join(data_dir, 'precheck.json'), os.path.join(S.ROOT, 'dist', 'precheck.json')):
        try:
            p = json.load(open(fp, encoding='utf-8'))
        except (OSError, ValueError):
            continue
        if not best or str(p.get('checked', '')) > str(best.get('checked', '')):
            best = p
    return best


def build(data_dir=S.DATA):
    pages, led = S.collect(data_dir), {r['url']: r for r in S.ledger(data_dir)}
    labels, pre = _labels(data_dir), _precheck(data_dir)
    meta = json.load(open(os.path.join(data_dir, 'meta.json'), encoding='utf-8'))

    def where(x):
        if x['file'] == 'edges':
            a, t, b = (x['owner'].split(' ') + ['', '', ''])[:3]
            return f'A link: {labels.get(a, a)} → {labels.get(b, b)}'
        return f"{WORD.get(x['file'], x['file'])}: {labels.get(x['owner'], x['owner'])}"

    order = sorted(pages.items(), key=lambda kv: (kv[1]['tier'], -len(kv[1]['items']), S.host(kv[0]), kv[0]))
    out = []
    for url, p in order:
        pc = (pre.get('pages') or {}).get(url)
        out.append({'url': url, 'host': S.host(url), 'tier': p['tier'], 'gate': p['tier'] <= GATE,
                    'items': [{'where': where(x), 'text': x['text'], 'source': x['source'], 'flag': x['flag'],
                               'nolink': x['nolink'], 'quotes': x['quotes']} for x in p['items']],
                    'reread': led.get(url), 'precheck': pc})
    return {'repo': meta.get('repo') or '', 'branch': meta.get('repo_branch') or 'main', 'inbox': 'data/' + S.INBOX,
            'tiers': S.TIERS, 'precheck_at': pre.get('checked'), 'pages': out}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default=S.DATA)
    ap.add_argument('--out', default=os.path.join(S.ROOT, 'site', 'reread-queue.json'))
    a = ap.parse_args()
    q = build(a.data)
    with open(a.out, 'w', encoding='utf-8') as fh:
        json.dump(q, fh, ensure_ascii=False, separators=(',', ':'))
    gate = [p for p in q['pages'] if p['gate']]
    print(f'wrote {os.path.relpath(a.out, S.ROOT)}: {len(q["pages"])} pages, {len(gate)} before going public')


if __name__ == '__main__':
    main()
