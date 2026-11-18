#!/usr/bin/env python3
"""Write the map's data for researchers: the whole graph as one JSON file, flat CSV tables, and DATA.md.

  python3 tools/export_data.py                  -> dist/data/ and dist/data/ideals-map-data.zip
  python3 tools/export_data.py --out DIR        (tools/package.py calls this with dist/site/data)

Every table carries the map's stable ids, so rows join across tables and across releases. Nested lists are
broken out into their own tables (quotes, phase conditions, Watch checks and responses, sources); any other
nested field stays in its column as JSON. Nothing is added, summed or scored: these are the records as the map
holds them, with their checking flags.
"""
import argparse, csv, json, os, shutil, sys, zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sources as S

NODE_FILES = ['ideals', 'carriers', 'vehicles', 'fruits', 'texts', 'funders', 'labs', 'evaluators', 'patterns',
              'mechanisms', 'offshoots']
# Broken out into tables of their own, so they are not repeated as JSON in the parent row.
BROKEN_OUT = {'words', 'phases'}


def load(name):
    fp = os.path.join(S.DATA, name + '.json')
    return json.load(open(fp, encoding='utf-8')) if os.path.exists(fp) else []


def cell(v):
    if v is None:
        return ''
    if isinstance(v, (list, dict)):
        return json.dumps(v, ensure_ascii=False)
    return v


def write_table(out, name, rows, first=('id',)):
    cols = []
    for r in rows:
        for k in r:
            if k not in cols:
                cols.append(k)
    cols = [c for c in first if c in cols] + [c for c in cols if c not in first]
    with open(os.path.join(out, name + '.csv'), 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({k: cell(r.get(k)) for k in cols})
    return name + '.csv', len(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(S.ROOT, 'dist', 'data'))
    a = ap.parse_args()
    if os.path.exists(a.out):
        shutil.rmtree(a.out)
    os.makedirs(a.out)
    made = []
    quotes, conds = [], []
    for name in NODE_FILES:
        recs = load(name)
        rows = [{k: v for k, v in r.items() if k not in BROKEN_OUT} for r in recs]
        made.append(write_table(a.out, name, rows))
        for r in recs:
            for w in r.get('words') or []:
                quotes.append(dict({'owner_file': name, 'owner_id': r['id']}, **w))
            for p in r.get('phases') or []:
                for c in p.get('conditions') or []:
                    conds.append(dict({'ideal_id': r['id'], 'phase': p.get('phase')}, **c))
    made.append(write_table(a.out, 'quotes', quotes, first=('owner_file', 'owner_id', 'speaker', 'quote')))
    made.append(write_table(a.out, 'phase_conditions', conds, first=('ideal_id', 'phase', 'status', 'text')))
    edges = [dict({'edge_index': i}, **e) for i, e in enumerate(load('edges'))]
    made.append(write_table(a.out, 'edges', edges, first=('edge_index', 'from', 'type', 'to', 'sentence')))
    watch = load('watch')
    made.append(write_table(a.out, 'watch', [{k: v for k, v in w.items() if k not in ('checks', 'responses')} for w in watch]))
    made.append(write_table(a.out, 'watch_checks', [dict({'watch_id': w['id']}, **c) for w in watch for c in w.get('checks') or []],
                            first=('watch_id', 'result', 'what')))
    made.append(write_table(a.out, 'watch_responses', [dict({'watch_id': w['id']}, **r) for w in watch for r in w.get('responses') or []],
                            first=('watch_id', 'who', 'what')))
    pages, led = S.collect(), {r['url']: r for r in S.ledger()}
    links_fp = os.path.join(S.ROOT, 'dist', 'links.json')
    links = json.load(open(links_fp))['pages'] if os.path.exists(links_fp) else {}
    src = []
    for url, p in sorted(pages.items(), key=lambda kv: (kv[1]['tier'], kv[0])):
        r, lk = led.get(url, {}), links.get(url, {})
        src.append({'url': url, 'host': S.host(url), 'tier': p['tier'], 'tier_name': S.TIERS[p['tier']], 'items': len(p['items']),
                    'cited_by': ' '.join(sorted({f"{x['file']}:{x['owner']}" for x in p['items']})),
                    'machine_flags': ' '.join(sorted({x['flag'] for x in p['items']})),
                    'reread_result': r.get('result', ''), 'reread_date': r.get('date', ''),
                    'link_status': lk.get('status', ''), 'link_code': lk.get('code', '')})
    made.append(write_table(a.out, 'sources', src, first=('url',)))
    shutil.copy(os.path.join(S.DATA, 'meta.json'), os.path.join(a.out, 'meta.json'))
    graph = {n: load(n) for n in NODE_FILES + ['edges', 'phases', 'watch']}
    graph['meta'] = json.load(open(os.path.join(S.DATA, 'meta.json'), encoding='utf-8'))
    graph['reread'] = S.ledger()
    json.dump(graph, open(os.path.join(a.out, 'graph.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)
    shutil.copy(os.path.join(S.ROOT, 'DATA.md'), os.path.join(a.out, 'DATA.md'))
    shutil.copy(os.path.join(S.ROOT, 'LICENSE-DATA.md'), os.path.join(a.out, 'LICENSE-DATA.md'))
    zp = os.path.join(a.out, 'ideals-map-data.zip')
    with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in sorted(os.listdir(a.out)):
            if f != 'ideals-map-data.zip':
                z.write(os.path.join(a.out, f), os.path.join('ideals-map-data', f))
    print('data: ' + ', '.join(f'{n} ({k})' for n, k in made))
    print('wrote', os.path.relpath(a.out, S.ROOT), '(graph.json, DATA.md, ideals-map-data.zip)')


if __name__ == '__main__':
    main()
