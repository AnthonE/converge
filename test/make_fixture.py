#!/usr/bin/env python3
"""Write a neutral, obviously synthetic data set that stresses the layout:
one crowded ideal (10 carriers, 6 texts, 6 vehicles, 9 events) and several sparse ones."""
import json, os, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'fixture')
ST = ['met', 'partly', 'not_met', 'unknown']
ideals, carriers, vehicles, fruits, texts, edges = [], [], [], [], [], []
N = 9
for i in range(N):
    iid = f'ideal-{i}'
    ideals.append({
        'id': iid, 'label': f'Sample ideal number {i} with a longish name',
        'ideal': f'Placeholder statement of sample ideal {i}.', 'summary': 'Synthetic test data, not a claim.',
        'phases': [{'phase': p, 'conditions': [
            {'text': f'Observable condition {p}.{k} for ideal {i}', 'status': ST[(i + p + k) % 4],
             'evidence': 'fixture evidence', 'url': 'https://example.org/evidence'} for k in range(2)]}
            for p in range(6) if (i + p) % 5],
        'words': [{'speaker': 'Sample Speaker', 'quote': 'A short sample quotation.', 'source': 'Sample Source',
                   'url': 'https://example.org/source', 'date': '2020-01-01', 'verified': ['primary', 'secondary', 'unverified'][i % 3]}],
        'cautions': ['Synthetic fixture.'],
    })
    crowd = i == 0
    for c in range(10 if crowd else 1 + i % 3):
        cid = f'carrier-{i}-{c}'
        carriers.append({'id': cid, 'label': f'Carrier {i}.{c} Collective', 'kind': 'movement', 'status': 'active (fixture)', 'note': 'Synthetic.'})
        edges.append({'from': cid, 'to': iid, 'type': 'carries', 'sentence': f'Carrier {i}.{c} carries sample ideal {i}.'})
        if c < (6 if crowd else 1):
            vid = f'vehicle-{i}-{c}'
            vehicles.append({'id': vid, 'label': f'Vehicle {i}.{c} Model', 'note': 'Synthetic.'})
            edges.append({'from': cid, 'to': vid, 'type': 'runs_on', 'sentence': f'Carrier {i}.{c} runs on vehicle {i}.{c}.'})
        if c < (9 if crowd else 2):
            fid = f'fruit-{i}-{c}'
            fruits.append({'id': fid, 'date': f'202{c % 6}-0{1 + c % 9}', 'label': f'Sample event {i}.{c} happened here',
                           'what': 'A synthetic event.', 'kind': ['documented', 'reported', 'alleged'][c % 3],
                           'source': 'Sample Outlet', 'url': 'https://example.org/event', 'verified': ['primary', 'secondary', 'unverified'][c % 3]})
            edges.append({'from': cid, 'to': fid, 'type': 'bears_fruit', 'sentence': f'Carrier {i}.{c} bore event {i}.{c}.'})
    for t in range(6 if crowd else 1 + i % 2):
        tid = f'text-{i}-{t}'
        texts.append({'id': tid, 'ref': f'Sample {i + 1}:{t + 1}-{t + 3}', 'quote': 'Sample words of a text.'})
        edges.append({'from': iid, 'to': tid, 'type': 'parallels', 'sentence': f'Sample ideal {i} parallels Sample {i + 1}:{t + 1}.', 'lens': True})
for i in range(1, N):
    edges.append({'from': f'ideal-{i}', 'to': f'ideal-{(i * 4) % N}', 'type': 'descends_from' if i % 2 else 'opposes',
                  'sentence': f'Sample ideal {i} is linked to sample ideal {(i * 4) % N}.'})
edges.append({'from': 'carrier-1-0', 'to': 'ideal-0', 'type': 'carries', 'sentence': 'Carrier 1.0 also carries sample ideal 0.'})
edges = [e for e in edges if e['from'] != e['to']]

# The money layer: 24 funders (more than one column holds), 3 companies, 5 evaluators, a venue and a regranter.
funders, labs, evaluators = [], [], []
def flow(a, b, t, i, **kw):
    e = {'from': a, 'to': b, 'type': t, 'sentence': f'Sample record: {a} {t} {b}.', 'source': 'Sample Register',
         'url': 'https://example.org/register', 'verified': ['primary', 'secondary', 'unverified'][i % 3],
         'kind': ['documented', 'reported', 'alleged'][i % 3]}
    if t == 'funds':
        e['money'] = ['grant', 'investment', 'government', 'commission', 'political'][i % 5]
    e.update(kw); edges.append(e)
KINDS = ['person', 'foundation', 'fund', 'firm', 'company', 'government', 'nonprofit']
for i in range(24):
    funders.append({'id': f'funder-{i}', 'label': f'Sample Funder {i} with a fairly long name', 'kind': KINDS[i % 7], 'note': 'Synthetic.'})
for i in range(3):
    labs.append({'id': f'lab-{i}', 'label': f'Sample Model Company {i}', 'note': 'Synthetic.'})
for i in range(5):
    evaluators.append({'id': f'evaluator-{i}', 'label': f'Sample Evaluation Institute {i}', 'note': 'Synthetic.',
                       'policy': {'speaker': f'Sample Evaluation Institute {i}', 'quote': 'A sample statement about independence.',
                                  'source': 'Sample Policy Page', 'url': 'https://example.org/policy', 'verified': 'secondary'}})
evaluators[0]['disputes'] = [{'date': '2025-01', 'what': 'A sample episode was reported.', 'response': 'A sample reply was published.',
                              'kind': 'reported', 'source': 'Sample Outlet', 'url': 'https://example.org/episode', 'verified': 'secondary'}]
carriers.append({'id': 'venue-0', 'label': 'Sample Venue', 'kind': 'venue', 'status': 'open (fixture)', 'note': 'Synthetic.'})
for i in range(24):
    flow(f'funder-{i}', f'carrier-{i % N}-0', 'funds', i, amount=f'${i + 1} million', date=f'20{10 + i % 16}')
    if i % 3 == 0:
        flow(f'funder-{i}', f'evaluator-{i % 5}', 'funds', i, amount='$250,000', date='2024-03')
    if i < 3:   # the same pair, several records
        flow(f'funder-{i}', f'carrier-{i % N}-0', 'funds', i + 1, amount='$90,000', date='2021')
flow('funder-0', 'funder-1', 'funds', 0, amount='$5 million', date='2019')          # a regranter: gives and receives
flow('funder-2', 'lab-0', 'funds', 1, amount='$30 million', date='2017')
flow('funder-3', 'vehicle-0-0', 'funds', 2, amount='$50,000', date='2024-07')
for i in range(3):
    flow(f'lab-{i}', f'evaluator-{i}', 'funds', i, date='2025')                    # the evaluated pays the evaluator
    for k in range(5):
        if (i + k) % 2 == 0 or k == i:
            flow(f'evaluator-{k}', f'lab-{i}', 'evaluates', k, date='2025-06')
flow('evaluator-4', 'vehicle-0-1', 'evaluates', 0)
flow('funder-4', 'venue-0', 'funds', 0, amount='$20 million', date='2022')
for i in range(4):
    flow('venue-0', f'carrier-{i}-0', 'hosts', i, date=f'202{2 + i}')
flow('venue-0', 'evaluator-0', 'hosts', 1, date='2025')
# The ancient layer: 7 patterns, 4 mechanisms, 2 offshoots, a field key on one ideal.
patterns, mechanisms, offshoots = [], [], []
for k in range(7):
    patterns.append({'id': f'pattern-{k}', 'label': f'Sample ancient pattern {k}', 'summary': 'Synthetic.',
                     'sources': [{'tradition': 'Sample tradition', 'work': 'Sample Work', 'passage': f'{k}.1', 'translation': 'Sample translator',
                                  'quote': 'A short sample line.', 'url': 'https://example.org/text', 'verified': ['primary', 'secondary', 'unverified'][k % 3]}],
                     'texts': [f'text-0-{k % 6}'], 'counter': [{'ref': 'Sample 1:1', 'text': 'A sample counter-reading.'}]})
for k in range(4):
    mechanisms.append({'id': f'mechanism-{k}', 'label': f'Sample mechanism {k}', 'definition': 'A synthetic definition.',
                       'scholarship': [{'author': 'Sample Author', 'title': 'Sample Study', 'year': '2020', 'url': 'https://example.org/study', 'claim': 'Synthetic.', 'verified': 'secondary'}]})
    edges.append({'from': f'mechanism-{k}', 'to': f'pattern-{k}', 'type': 'reads_as', 'lens': True, 'sentence': f'Sample reading of mechanism {k}.', 'limit': 'A sample limit.'})
for i in range(N):
    edges.append({'from': f'carrier-{i}-0', 'to': f'pattern-{i % 7}', 'type': 'invokes', 'sentence': f'Carrier {i}.0 invokes pattern {i % 7}.', 'about': f'ideal-{i}',
                  'speaker': f'Carrier {i}.0', 'quote': 'Sample invoked words.', 'source': 'Sample Source', 'url': 'https://example.org/words', 'date': '2024',
                  'verified': 'secondary', 'sense': ['sincere', 'ironic', 'metaphor', 'unclear'][i % 4]})
    edges.append({'from': f'ideal-{i}', 'to': f'pattern-{(i + 3) % 7}', 'type': 'reads_as', 'lens': True, 'sentence': f'Sample reading of ideal {i}.', 'limit': 'A sample limit.'})
    edges.append({'from': f'carrier-{i}-0', 'to': f'mechanism-{i % 4}', 'type': 'uses', 'sentence': f'Carrier {i}.0 uses mechanism {i % 4}.',
                  'source': 'Sample Source', 'url': 'https://example.org/use', 'verified': 'secondary', 'kind': ['reported', 'documented', 'alleged'][i % 3]})
for k, (src, dest) in enumerate([('carrier-0-1', 'ideal-0'), ('carrier-2-0', 'ideal-2')]):
    offshoots.append({'id': f'offshoot-{k}', 'label': f'\u201cSample Offshoot {k}\u201d', 'status': 'Cases pending (fixture)', 'note': 'Synthetic.',
                      'why_not': 'No program it states.', 'cautions': ['Synthetic fixture.'],
                      'record': [{'date': '2024-05', 'what': 'A synthetic charge.', 'kind': 'alleged', 'status': 'pending', 'source': 'Sample Outlet', 'url': 'https://example.org/record', 'verified': 'secondary'}]})
    edges.append({'from': f'offshoot-{k}', 'to': src, 'type': 'breaks_from', 'sentence': f'Sample offshoot {k} came out of {src}.',
                  'source': 'Sample Outlet', 'url': 'https://example.org/lineage', 'verified': 'secondary', 'kind': 'reported'})
mechanisms[0]['pushback'] = [{'sentence': 'A sample record against the mechanism.', 'source': 'Sample Ruling', 'url': 'https://example.org/ruling', 'verified': 'secondary'}]
# Words and a reading of the same pair (ideal-4 reads beside pattern-0): two lines, never one.
edges.append({'from': 'carrier-4-0', 'to': 'pattern-0', 'type': 'invokes', 'about': 'ideal-4', 'sentence': 'Carrier 4.0 invokes pattern 0.', 'speaker': 'Carrier 4.0',
              'quote': 'Words beside a reading.', 'source': 'Sample Source', 'url': 'https://example.org/mixed', 'verified': 'secondary', 'sense': 'metaphor'})
# An offshoot that came out of a vehicle is listed on the overview and drawn under no ideal.
offshoots.append({'id': 'offshoot-2', 'label': 'Sample Offshoot From A Forum', 'status': 'Historical (fixture)', 'why_not': 'No program it states.',
                  'record': [{'date': '2020', 'what': 'A synthetic historical record.', 'kind': 'documented', 'status': 'historical', 'source': 'Sample Archive',
                              'url': 'https://example.org/archive', 'verified': 'secondary'}]})
edges.append({'from': 'offshoot-2', 'to': 'vehicle-0-0', 'type': 'breaks_from', 'sentence': 'Sample offshoot 2 came out of a forum.',
              'source': 'Sample Outlet', 'url': 'https://example.org/forum', 'verified': 'secondary', 'kind': 'reported'})
# A level pair (ideal-1 and pattern-0 sit at the same height): words and a reading must still draw apart.
edges.append({'from': 'ideal-1', 'to': 'pattern-0', 'type': 'reads_as', 'lens': True, 'sentence': 'Sample reading of ideal 1 beside pattern 0.', 'limit': 'A sample limit.'})
edges.append({'from': 'carrier-1-0', 'to': 'pattern-0', 'type': 'invokes', 'about': 'ideal-1', 'sentence': 'Carrier 1.0 invokes pattern 0.', 'speaker': 'Carrier 1.0',
              'quote': 'Words beside a level reading.', 'source': 'Sample Source', 'url': 'https://example.org/level', 'verified': 'secondary', 'sense': 'unclear'})
# An offshoot's other links are listed on its panel.
edges.append({'from': 'offshoot-2', 'to': 'carrier-1-0', 'type': 'opposes', 'sentence': 'Sample offshoot 2 opposes carrier 1.0.', 'source': 'Sample Outlet',
              'url': 'https://example.org/opposes', 'verified': 'secondary', 'kind': 'reported'})
# A funder carries no ideal: its own words must still show on the pattern's panel.
edges.append({'from': 'funder-0', 'to': 'pattern-0', 'type': 'invokes', 'sentence': 'Funder 0 invokes pattern 0.', 'speaker': 'Sample Funder 0',
              'quote': 'Words from a name outside every ideal.', 'source': 'Sample Source', 'url': 'https://example.org/funder-words',
              'verified': 'secondary', 'sense': 'sincere'})
ideals[0]['field_key'] = [{'q': q, 'a': 'A sample answer.'} for q in ('How did it come?', 'Does it speak?', 'Does it survive your silence?', 'How many independent channels?', 'Who stands outside?')]
os.makedirs(OUT, exist_ok=True)
for name, obj in [('ideals', ideals), ('carriers', carriers), ('vehicles', vehicles), ('fruits', fruits), ('texts', texts), ('edges', edges),
                  ('funders', funders), ('labs', labs), ('evaluators', evaluators),
                  ('patterns', patterns), ('mechanisms', mechanisms), ('offshoots', offshoots)]:
    json.dump(obj, open(os.path.join(OUT, name + '.json'), 'w'), indent=1)
shutil.copy(os.path.join(HERE, '..', 'data', 'phases.json'), os.path.join(OUT, 'phases.json'))
json.dump([{'id': 'claim-1', 'date': '2026-01-02', 'title': 'A <b>sample</b> claim in circulation', 'claimed_by': 'Sample Outlet', 'standing': 'A sample outlet.', 'claim': 'Something happened.',
            'source': 'Sample Outlet, 2 Jan 2026', 'url': 'https://example.org/claim', 'kind': 'reported', 'status': 'partly checked',
            'checks': [{'what': 'A sample check.', 'result': 'partly supports', 'source': 'Sample Record', 'url': 'https://example.org/record', 'verified': 'secondary'}],
            'responses': [{'who': 'A party', 'what': 'declined to comment.', 'source': 'Sample Outlet'}], 'open': ['A sample open question.'],
            'cautions': ['A sample caution.'], 'touches': ['ideal-0'], 'why': 'A sample reason.',
            'travelled': [{'date': '2025-12-30', 'who': 'An anonymous post', 'said': 'Many do.', 'source': 'a post, not linked'},
                          {'date': '2026-01-02', 'who': 'Sample Outlet', 'said': 'It is hard to know; records suggest some do.', 'source': 'Sample Outlet',
                           'url': 'https://example.org/claim', 'verified': 'primary', 'cites': 'filings', 'changed': '“Many” becomes “some”, hedged.'},
                          {'date': '2026-01-03', 'who': 'Second <i>Outlet</i>', 'said': 'A disproportionate number have been.', 'source': 'Second Outlet',
                           'cites': 'Sample Outlet', 'changed': 'The hedge is dropped.', 'scores': {'hedges': 0, 'attribution': 3, 'label': None}}],
            'travelled_summary': 'A sample summary of the scores.'},
           {'id': 'claim-2', 'date': '2026-01-05', 'title': 'A second sample claim', 'claimed_by': 'Sample Account', 'standing': 'A sample account.', 'claim': 'Something else.',
            'source': 'Sample Account, 5 Jan 2026', 'kind': 'claimed', 'status': 'not checked'}], open(os.path.join(OUT, 'watch.json'), 'w'))
json.dump({'title': 'The Ideals Map (fixture)', 'note': 'Synthetic test data.', 'disclosure': 'Synthetic fixture: no ties.',
           'made_with': 'Synthetic fixture, made by a script.', 'nolink_hosts': ['example.net']}, open(os.path.join(OUT, 'meta.json'), 'w'))
# Who's who: a public figure named in the sample quotations.
json.dump([{'id': 'sample-speaker', 'name': 'Sample Speaker', 'who': 'A sample public figure, described in one plain sentence.', 'group': 'thinkers',
            'source': 'Sample Encyclopedia', 'url': 'https://example.org/sample-speaker', 'verified': 'secondary', 'sort': 'Speaker', 'node': 'carrier-0-0'}],
          open(os.path.join(OUT, 'people.json'), 'w'), indent=1)
# An alignment method with the five questions, and a door with three stops.
def ans(q, own=False):
    d = {'q': q, 'kind': 'own words' if own else 'reading', 'a': f'A sample answer to {q}.'}
    if own:
        d.update({'speaker': 'Sample Model Company 0', 'quote': 'Sample words that answer it.', 'source': 'Sample Paper', 'url': 'https://example.org/paper', 'verified': 'primary'})
    return d
json.dump([{'id': 'sample-method', 'label': 'A sample method', 'plain': 'A sample method, in plain words.',
            'bet': {'speaker': 'Sample Model Company 0', 'quote': 'Sample words on what it bets on.', 'source': 'Sample Paper', 'url': 'https://example.org/paper', 'verified': 'primary', 'date': '2024'},
            'key': [ans('serves', True), ans('values'), ans('inside'), ans('checks'), ans('fails')],
            'pushed_by': [{'name': 'Sample Model Company 0', 'node': 'lab-0', 'how': 'Uses it in training.', 'source': 'Sample Paper', 'url': 'https://example.org/paper', 'verified': 'primary'}],
            'pushback': [{'speaker': 'A sample critic', 'quote': 'Sample critical words.', 'source': 'Sample Reply', 'url': 'https://example.org/reply', 'verified': 'primary', 'date': '2025'}],
            'cautions': ['A sample caution.']}], open(os.path.join(OUT, 'methods.json'), 'w'), indent=1)
json.dump([{'id': 'sample-door', 'label': 'A sample viewpoint', 'lede': 'What this door shows.',
            'stops': [{'record': 'ideal-0', 'why': 'The first ideal.'}, {'view': 'methods', 'title': 'Methods', 'why': 'Side by side.'},
                      {'record': 'sample-method', 'why': 'One method.'}]}], open(os.path.join(OUT, 'doors.json'), 'w'), indent=1)
# One page a person has re-read: the viewer shows it beside the machine's flag.
json.dump([{'url': fruits[0]['url'], 'date': '2026-01-10', 'result': 'holds'}], open(os.path.join(OUT, 'reread.json'), 'w'), indent=1)
print('fixture written')
