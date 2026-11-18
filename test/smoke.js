/* Smoke test for the Ideals Map viewer. Usage: node test/smoke.js <standalone.html> [shots-dir]
   Fails (exit 1) on any console error, a missing node, overlapping labels beyond a small
   tolerance, or a control that does not work. */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const file = path.resolve(process.argv[2]);
  const shots = process.argv[3] ? path.resolve(process.argv[3]) : null;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  const fail = msg => { errors.push(msg); };

  await page.goto('file://' + file);
  await page.waitForSelector('#map .node');
  const graph = await page.evaluate(() => JSON.parse(document.getElementById('graph-data').textContent));

  // Overview: one node per ideal.
  const nIdeals = await page.locator('#map .node-ideal').count();
  if (nIdeals !== graph.ideals.length) fail(`overview shows ${nIdeals} ideals, data has ${graph.ideals.length}`);
  if (shots) await page.screenshot({ path: path.join(shots, 'overview-light.png'), fullPage: true });

  // Label overlap check: count pairs of label boxes that intersect by more than 6px both ways.
  const overlaps = async () => page.evaluate(() => {
    const boxes = [...document.querySelectorAll('#map text.lbl, #map text.cap, #map g.pips')].map(t => t.getBoundingClientRect());
    let bad = 0;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 6 && h > 6) bad++;
    }
    return bad;
  });
  const ov = await overlaps();
  if (ov > 0) fail(`overview: ${ov} overlapping label pair(s)`);

  // Focus each ideal: the panel names it, the hash updates, nothing overlaps, nothing is off-canvas.
  let worst = 0;
  for (const d of graph.ideals) {
    await page.evaluate(id => { location.hash = '#' + id; }, d.id);
    await page.waitForFunction(id => document.querySelector('#stage').dataset.view === 'focus' &&
      document.querySelector('.role-centre')?.dataset.id === id, d.id);
    const title = await page.locator('#panel h2').first().textContent();
    if (title !== d.label) fail(`focus ${d.id}: panel title "${title}"`);
    const o = await overlaps();
    worst = Math.max(worst, o);
    if (o > 0) fail(`focus ${d.id}: ${o} overlapping label pair(s)`);
    const off = await page.evaluate(() => {
      const s = document.getElementById('map').getBoundingClientRect();
      return [...document.querySelectorAll('#map text.lbl')].filter(t => {
        const r = t.getBoundingClientRect();
        return r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1;
      }).length;
    });
    if (off > 0) fail(`focus ${d.id}: ${off} label(s) outside the canvas`);
  }

  // Nothing is drawn without a link, and every node is drawn in some focus view unless a view says it left some out.
  const everDrawn = new Set(), drawnInFocus = new Set(); let anyDropped = false;
  for (const d of graph.ideals) {
    await page.evaluate(id => { location.hash = '#' + id; }, d.id);
    await page.waitForFunction(id => document.querySelector('.role-centre')?.dataset.id === id, d.id);
    const v = await page.evaluate(() => ({ ids: [...document.querySelectorAll('#map .node')].map(n => n.dataset.id),
      more: document.getElementById('more').textContent }));
    v.ids.forEach(x => { everDrawn.add(x); drawnInFocus.add(x); });
    if (v.more) anyDropped = true;
    const tied = new Set();
    graph.edges.forEach(e => { if (v.ids.includes(e.from) && v.ids.includes(e.to)) { tied.add(e.from); tied.add(e.to); } });
    const loose = v.ids.filter(x => !tied.has(x));
    if (loose.length) fail(`focus ${d.id}: drawn with no link: ${loose.join(', ')}`);
    // Whatever is linked to the ideal itself is drawn, or the view says it left some out.
    const direct = new Set(); graph.edges.forEach(e => { if (e.from === d.id) direct.add(e.to); if (e.to === d.id) direct.add(e.from); });
    // Ancient patterns and mechanisms live in the ancients view; the ideal's panel links there.
    const elsewhere = new Set([...(graph.patterns || []), ...(graph.mechanisms || [])].map(n => n.id));
    const gone = [...direct].filter(x => !v.ids.includes(x) && !elsewhere.has(x));
    if (gone.length && !v.more) fail(`focus ${d.id}: linked to the ideal but not drawn and not counted: ${gone.join(', ')}`);
  }
  const offCanvas = () => page.evaluate(() => {
    const s = document.getElementById('map').getBoundingClientRect();
    return [...document.querySelectorAll('#map text.lbl')].filter(t => {
      const r = t.getBoundingClientRect();
      return r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1;
    }).length;
  });

  // The money and evaluators view, when the data has one.
  const MONEY = ['funds', 'evaluates', 'hosts'];
  const flows = graph.edges.filter(e => MONEY.includes(e.type));
  const moneyNodes = [...(graph.funders || []), ...(graph.labs || []), ...(graph.evaluators || [])];
  if (flows.length) {
    await page.locator('#tab-money').click();
    await page.waitForFunction(() => document.querySelector('#stage').dataset.view === 'money');
    if ((await page.locator('#tab-money').getAttribute('aria-pressed')) !== 'true') fail('money tab is not marked pressed');
    if (!(await page.locator('#legend-money').isVisible()) || (await page.locator('#legend-ideals').isVisible())) fail('money view shows the wrong legend');
    if (!(await page.locator('#panel .loop').count())) fail('money view shows no disclosure line');
    let o = await overlaps(); if (o > 0) fail(`money overview: ${o} overlapping label pair(s)`);
    let off = await offCanvas(); if (off > 0) fail(`money overview: ${off} label(s) outside the canvas`);
    if (shots) await page.screenshot({ path: path.join(shots, 'money-overview-light.png'), fullPage: true });
    // No name stands in the overview without a line to another name drawn there.
    const ovIds = await page.evaluate(() => [...document.querySelectorAll('#map .node')].map(n => n.dataset.id));
    const alone = ovIds.filter(x => !flows.some(e => (e.from === x && ovIds.includes(e.to)) || (e.to === x && ovIds.includes(e.from))));
    if (alone.length) fail(`money overview: drawn with no line: ${alone.join(', ')}`);

    // Turn the view to every name that has a record. Each is drawn with all its records' other ends, or says it left some out.
    const ends = new Set(); flows.forEach(e => { ends.add(e.from); ends.add(e.to); });
    for (const id of ends) {
      await page.evaluate(x => { location.hash = '#money/' + x; }, id);
      await page.waitForFunction(x => document.querySelector('.role-money-centre')?.dataset.id === x, id);
      const v = await page.evaluate(() => ({ ids: [...document.querySelectorAll('#map .node')].map(n => n.dataset.id),
        more: document.getElementById('more').textContent, lines: document.querySelectorAll('#map .edge').length }));
      v.ids.forEach(x => everDrawn.add(x));
      // An alleged record is listed in the panel and never drawn: it places no name and no line (spec section 8, guardrail 4).
      const others = new Set(); flows.filter(e => e.kind !== 'alleged').forEach(e => { if (e.from === id) others.add(e.to); if (e.to === id) others.add(e.from); });
      const lost = [...others].filter(x => !v.ids.includes(x));
      if (lost.length && !v.more) fail(`money ${id}: not drawn and not counted as left out: ${lost.join(', ')}`);
      if (others.size && !v.lines) fail(`money ${id}: no line drawn`);
      const byWord = v.ids.filter(x => x !== id && !others.has(x));
      if (byWord.length) fail(`money ${id}: drawn from an allegation alone: ${byWord.join(', ')}`);
      o = await overlaps(); if (o > 0) fail(`money ${id}: ${o} overlapping label pair(s)`);
      off = await offCanvas(); if (off > 0) fail(`money ${id}: ${off} label(s) outside the canvas`);
      // An event that hangs on a name tied to no ideal, or tied only by a reading, is listed in that name's panel.
      (await page.evaluate(() => [...document.querySelectorAll('#panel [data-event]')].map(x => x.dataset.event))).forEach(x => everDrawn.add(x));
      const rows = await page.locator('#panel .flow').count();
      const want = flows.filter(e => e.from === id || e.to === id).length;
      if (rows !== want) fail(`money ${id}: panel lists ${rows} records, data has ${want}`);
    }

    // An evaluator paid by a company it evaluates gets the plain statement, and so does the company.
    const recs = flows.filter(e => e.kind !== 'alleged');
    const paysBack = (list, e) => list.some(f => f.type === 'funds' && f.from === e.to && f.to === e.from);
    const loop = recs.find(e => e.type === 'evaluates' && paysBack(recs, e));
    // A pair that exists only by allegation is not stated as a pair.
    const byClaim = flows.find(e => e.type === 'evaluates' && paysBack(flows, e) &&
      !recs.some(x => x.type === 'evaluates' && x.from === e.from && x.to === e.to && paysBack(recs, x)));
    if (byClaim) {
      const lab = moneyNodes.find(n => n.id === byClaim.to);
      await page.evaluate(x => { location.hash = '#money/' + x; }, byClaim.from);
      await page.waitForFunction(x => document.querySelector('.role-money-centre')?.dataset.id === x, byClaim.from);
      const boxes = await page.locator('#panel .loop').allTextContents();
      if (lab && boxes.some(t => t.startsWith('Both links are on record') && t.includes(lab.label))) fail(`money ${byClaim.from}: an allegation is stated as a record of the pair`);
    }
    if (loop) {
      for (const id of [loop.from, loop.to]) {
        await page.evaluate(x => { location.hash = '#money/' + x; }, id);
        await page.waitForFunction(x => document.querySelector('.role-money-centre')?.dataset.id === x, id);
        const said = await page.locator('#panel .loop').allTextContents();
        if (!said.some(t => t.startsWith('Both links are on record'))) fail(`money ${id}: paid-and-evaluated pair is not stated`);
      }
      if (shots) await page.screenshot({ path: path.join(shots, 'money-focus-light.png'), fullPage: true });
      // Choosing the line between them lists the records in both directions.
      await page.locator('#map .edge-hit').first().dispatchEvent('click');  // the line itself, not whatever lies over its midpoint
      const k = await page.locator('#panel .kicker').first().textContent();
      if (k !== 'Between two names') fail(`choosing a money line shows "${k}"`);
      else {
        // The panel lists every record between the two names it is headed with, in both directions.
        const head = await page.locator('#panel h2').first().textContent();
        const label = x => { const n = [...moneyNodes, ...graph.carriers, ...graph.vehicles, ...graph.fruits].find(m => m.id === x); return n ? n.label : x; };
        const between = flows.filter(e => head === label(e.from) + ' and ' + label(e.to) || head === label(e.to) + ' and ' + label(e.from)).length;
        const listed = await page.locator('#panel .flow').count();
        if (listed !== between) fail(`the line panel "${head}" lists ${listed} records, data has ${between}`);
        // The line panel is a money panel too: it carries the disclosure.
        if (!(await page.locator('#panel .loop').allTextContents()).some(t => t.startsWith('Disclosure:'))) fail(`the line panel "${head}" shows no disclosure line`);
      }
      await page.locator('#panel .back').click();
    }
    // A name in the panel turns the view to that name; the back button returns to the whole view.
    const next = await page.locator('#panel .flow .linkbtn').first().textContent();
    await page.locator('#panel .flow .linkbtn').first().click();
    const now = await page.locator('#panel h2').first().textContent();
    if (now !== next) fail(`choosing "${next}" in the panel shows "${now}"`);
    await page.locator('#panel .back').click();
    await page.waitForFunction(() => !document.querySelector('.role-money-centre'));
    // A hash that names no record, or a property every object inherits, falls back to the whole view.
    for (const bad of ['constructor', '__proto__', 'no-such-name']) {
      await page.evaluate(x => { location.hash = '#money/' + x; }, bad);
      await page.waitForFunction(() => location.hash === '#money', null, { timeout: 5000 }).catch(() => fail(`#money/${bad} did not fall back to the whole view`));
      if (await page.locator('.role-money-centre').count()) fail(`#money/${bad} turned the view to a name`);
    }
    if (shots) {
      await page.locator('#theme').click();
      await page.screenshot({ path: path.join(shots, 'money-overview-dark.png'), fullPage: true });
      await page.locator('#theme').click();
    }
    await page.locator('#tab-ideals').click();
    await page.waitForFunction(() => document.querySelector('#stage').dataset.view === 'overview');

    // From the ideals map, a carrier with a money record leads to its money view and back.
    const funded = graph.carriers.find(c => flows.some(e => e.to === c.id || e.from === c.id) &&
      graph.edges.some(e => e.from === c.id && e.type === 'carries'));
    if (funded) {
      const home = graph.edges.find(e => e.from === funded.id && e.type === 'carries').to;
      await page.evaluate(id => { location.hash = '#' + id; }, home);
      await page.waitForFunction(id => document.querySelector('.role-centre')?.dataset.id === id, home);
      const mark = page.locator(`#map .node[data-id="${funded.id}"]`);
      if (await mark.count()) {
        await mark.click();
        await page.locator('#panel .more-btn', { hasText: 'money' }).click();
        await page.waitForFunction(id => document.querySelector('.role-money-centre')?.dataset.id === id, funded.id);
        const back = page.locator('#panel .links .linkbtn').last();
        await back.click();
        await page.waitForFunction(id => document.querySelector('.role-centre')?.dataset.id === id, home);
      }
      await page.evaluate(() => { location.hash = ''; });
      await page.waitForFunction(() => document.querySelector('#stage').dataset.view === 'overview');
    }
  } else if (!(graph.patterns || []).length && !(graph.watch || []).length && await page.locator('#views').isVisible()) fail('the view switch shows with no money, ancient or Watch data');

  // The Watch: every claim is listed newest first, with its status; an address opens one; a name on it leads to the map.
  if ((graph.watch || []).length) {
    await page.evaluate(() => { location.hash = '#watch'; });
    await page.waitForFunction(() => !document.getElementById('the-watch').hidden && document.getElementById('layout').hidden);
    // What is on screen, not attributes: the map, its legends and the overview button are gone; the tab is pressed.
    if (await page.locator('#layout').isVisible()) fail('the map still shows under the Watch');
    for (const s of ['#legend-ideals', '#legend-money', '#legend-ancients', '#to-overview']) if (await page.locator(s).isVisible()) fail(`${s} shows in the Watch`);
    if (await page.locator('#tab-watch').getAttribute('aria-pressed') !== 'true') fail('the Watch tab is not pressed');
    // Data is text, never markup; each claim shows its words.
    if (await page.locator('#the-watch .claim b').count()) fail('Watch data was inserted as markup');
    const said = await page.locator('#the-watch .claim-said q').allTextContents();
    const want = graph.watch.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.title.localeCompare(b.title)).map(w => w.claim);
    if (said.join('|') !== want.join('|')) fail('a Watch claim does not show its words');
    const dates = await page.locator('#the-watch .claim-head time').allTextContents();
    if (dates.length !== graph.watch.length) fail(`the Watch lists ${dates.length} of ${graph.watch.length} claims`);
    if (dates.join() !== dates.slice().sort().reverse().join()) fail('the Watch is not newest first');
    if ((await page.locator('#the-watch .claim-status').count()) !== graph.watch.length) fail('a Watch claim shows no status');
    // How it travelled: every step shows, in date order, with what changed; a reason shows where one is given.
    for (const w of graph.watch.filter(x => (x.travelled || []).length)) {
      const steps = await page.locator(`#watch-${w.id} .travelled .step`).count();
      if (steps !== w.travelled.length) fail(`${w.id}: ${steps} of ${w.travelled.length} travelled steps show`);
      const words = await page.locator(`#watch-${w.id} .travelled .step q`).allTextContents();
      if (words.join('|') !== w.travelled.map(t => t.said).join('|')) fail(`${w.id}: a travelled step does not show its words`);
      const changed = await page.locator(`#watch-${w.id} .travelled .step-changed`).count();
      if (changed !== w.travelled.filter(t => t.changed).length) fail(`${w.id}: a travelled step hides what changed`);
      if (await page.locator(`#watch-${w.id} .travelled i`).count()) fail(`${w.id}: travelled data was inserted as markup`);
      if (w.travelled.some(t => t.scores)) {
        const dots = await page.locator(`#watch-${w.id} .chain-chart .cc-dot`).count();
        const want = w.travelled.reduce((n, t) => n + ['hedges', 'attribution', 'label'].filter(k => t.scores && t.scores[k] !== null && t.scores[k] !== undefined).length, 0);
        if (dots !== want) fail(`${w.id}: the chain chart shows ${dots} of ${want} scores`);
      }
      const scored = await page.locator(`#watch-${w.id} .travelled .step-scores`).count();
      if (scored !== w.travelled.filter(t => t.scores).length) fail(`${w.id}: a step hides its scores`);
      if (w.travelled_summary && !(await page.locator(`#watch-${w.id} .step-summary`).textContent().catch(() => '')).includes(w.travelled_summary)) fail(`${w.id}: the score summary does not show`);
    }
    for (const w of graph.watch.filter(x => x.why)) {
      const why = await page.locator(`#watch-${w.id} .claim-why`).textContent().catch(() => '');
      if (!why.includes(w.why)) fail(`${w.id}: the reason it is here does not show`);
    }
    const w0 = graph.watch[0];
    await page.evaluate(x => { location.hash = '#watch/' + x; }, w0.id);
    await page.waitForFunction(x => document.activeElement && document.activeElement.id === 'watch-' + x, w0.id);
    const touch = graph.watch.find(w => (w.touches || []).length);
    if (touch) {
      await page.locator(`#watch-${touch.id} .claim-on .linkbtn`).first().click();
      await page.waitForFunction(() => document.getElementById('the-watch').hidden && !document.getElementById('layout').hidden);
      const first = touch.touches[0];
      if (graph.ideals.some(d => d.id === first)) await page.waitForFunction(x => document.querySelector('.role-centre')?.dataset.id === x, first);
      if (!(await page.locator('#layout').isVisible())) fail('the map does not come back after leaving the Watch');
      if (await page.locator('#tab-watch').getAttribute('aria-pressed') !== 'false') fail('the Watch tab stays pressed on the map');
    }
    await page.evaluate(() => { location.hash = ''; });
    await page.waitForFunction(() => document.querySelector('#stage').dataset.view === 'overview' && document.getElementById('the-watch').hidden);
  }

  // The ancients view, when the data has patterns.
  const ancientNodes = [...(graph.patterns || []), ...(graph.mechanisms || [])];
  if ((graph.patterns || []).length) {
    await page.locator('#tab-ancients').click();
    await page.waitForFunction(() => document.querySelector('#stage').dataset.view === 'ancients');
    if (!(await page.locator('#legend-ancients').isVisible())) fail('ancients view shows the wrong legend');
    let o = await overlaps(); if (o > 0) fail(`ancients view: ${o} overlapping label pair(s)`);
    let off = await offCanvas(); if (off > 0) fail(`ancients view: ${off} label(s) outside the canvas`);
    if (shots) await page.screenshot({ path: path.join(shots, 'ancients-light.png'), fullPage: true });
    const shown = await page.evaluate(() => ({ ids: [...document.querySelectorAll('#map .node')].map(n => n.dataset.id), more: document.getElementById('more').textContent }));
    const missing = ancientNodes.map(n => n.id).filter(x => !shown.ids.includes(x));
    if (missing.length && !shown.more) fail(`ancients view: not drawn and not counted: ${missing.join(', ')}`);
    // A pattern's panel lists its sources; a line's panel lists its records; a solid line exists for an invocation.
    const pat = graph.patterns[0].id;
    await page.evaluate(x => { location.hash = '#ancients/' + x; }, pat);
    await page.waitForFunction(x => document.querySelector('#panel h2')?.textContent && location.hash === '#ancients/' + x, pat);
    const k = await page.locator('#panel .kicker').first().textContent();
    if (k !== 'Ancient pattern') fail(`a pattern's panel shows "${k}"`);
    if (!(await page.locator('#panel .source').count())) fail('a pattern panel lists no sources');
    // Every invocation of the pattern is listed on its panel, including one by a name outside every ideal.
    const want = graph.edges.filter(e => e.type === 'invokes' && e.to === pat).map(e => e.quote);
    const got = await page.locator('#panel q').allTextContents();
    const lost = want.filter(q => !got.includes(q));
    if (lost.length) fail(`a pattern panel misses ${lost.length} invocation(s): ${lost[0]}`);
    if (graph.edges.some(e => e.type === 'invokes') && !(await page.locator('#map .edge-invokes').count())) fail('no solid line for an invocation');
    await page.locator('#map .edge-hit').first().dispatchEvent('click');  // the line itself, not whatever lies over its midpoint
    const lk = await page.locator('#panel .kicker').first().textContent();
    if (!['In their own words', 'How it takes hold', 'This project\u2019s reading'].includes(lk)) fail(`choosing an ancients line shows "${lk}"`);
    if (!(await page.locator('#panel .flow').count())) fail('an ancients line panel lists no records');
    // A mechanism's pushback is listed on its panel and never drawn as a line.
    const pb = (graph.mechanisms || []).find(m => (m.pushback || []).length);
    if (pb) {
      await page.evaluate(x => { location.hash = '#ancients/' + x; }, pb.id);
      await page.waitForFunction(x => location.hash === '#ancients/' + x && document.querySelector('#panel h2'), pb.id);
      const txt = await page.locator('#panel').textContent();
      if (!txt.includes(pb.pushback[0].sentence)) fail('a mechanism panel does not list its pushback');
    }
    // A carrier's words and this project's reading of the same pair are two lines, one solid and one dotted.
    const mixed = graph.edges.find(e => e.type === 'invokes' && e.about && graph.edges.some(r => r.type === 'reads_as' && r.from === e.about && r.to === e.to));
    // Every drawn invocation line is one the data says is about that ideal, and every such pair is drawn.
    await page.evaluate(() => { location.hash = '#ancients'; });
    await page.waitForFunction(() => document.querySelector('#stage').dataset.view === 'ancients' && !document.querySelector('#panel .back'));
    const drawnInv = new Set(await page.evaluate(() => [...document.querySelectorAll('#map .edge[data-i$=":invokes"]')].map(p => p.dataset.i)));
    const shownIds = new Set(await page.evaluate(() => [...document.querySelectorAll('#map .node')].map(n => n.dataset.id)));
    const wantInv = new Set(graph.edges.filter(e => e.type === 'invokes' && e.about && shownIds.has(e.about) && shownIds.has(e.to)).map(e => 'anc:' + e.about + '>' + e.to + ':invokes'));
    const extraInv = [...drawnInv].filter(x => !wantInv.has(x)), lostInv = [...wantInv].filter(x => !drawnInv.has(x));
    if (extraInv.length || lostInv.length) fail(`ancients view: invocation lines drawn without "about" (${extraInv.join(', ')}) or missing (${lostInv.join(', ')})`);
    // An alleged use is never drawn: no line stands for a pair whose only records are alleged.
    const usesDrawn = await page.evaluate(() => [...document.querySelectorAll('#map .edge[data-i$=":uses"]')].map(p => p.dataset.i));
    for (const k of usesDrawn) {
      const [a, b] = k.slice(4, -5).split('>');
      // The ideal's family: itself, its carriers (not by a reading) and what it runs on itself.
      const fam = new Set([a, ...graph.edges.filter(e => (e.type === 'carries' && e.to === a && !e.lens) || (e.type === 'runs_on' && e.from === a))
        .map(e => e.type === 'carries' ? e.from : e.to)]);
      const recs = graph.edges.filter(e => e.type === 'uses' && e.to === b && fam.has(e.from));
      if (recs.length && recs.every(e => e.kind === 'alleged')) fail(`ancients view: ${a} to ${b} is drawn from alleged uses alone`);
    }
    if (mixed) {
      const kinds = await page.evaluate(([a, b]) => [...document.querySelectorAll('#map .edge')].filter(p => p.dataset.i && p.dataset.i.startsWith('anc:' + a + '>' + b + ':'))
        .map(p => p.dataset.i.split(':').pop()), [mixed.about, mixed.to]);
      if (!(kinds.includes('invokes') && kinds.includes('reads_as'))) fail(`ancients view: words and a reading of ${mixed.about} and ${mixed.to} are not two lines (${kinds.join(', ')})`);
    }
    // Two lines for one pair must be visibly apart at their middle, even when the two ends sit level.
    const apart = await page.evaluate(() => {
      const by = {};
      [...document.querySelectorAll('#map .edge[data-i^="anc:"]')].forEach(p => { const k = p.dataset.i.replace(/:[a-z_]+$/, ''); (by[k] = by[k] || []).push(p); });
      let worst = Infinity;
      Object.values(by).filter(v => v.length > 1).forEach(v => {
        const m = v.map(p => p.getPointAtLength(p.getTotalLength() / 2));
        worst = Math.min(worst, Math.hypot(m[0].x - m[1].x, m[0].y - m[1].y));
      });
      return worst;
    });
    if (apart < 4) fail(`ancients view: two lines for one pair are only ${apart.toFixed(1)} units apart`);
    {
    }
    // An ideal with a field key shows it, and the button returns to the ideals map.
    const fk = graph.ideals.find(d => d.field_key);
    if (fk) {
      await page.evaluate(x => { location.hash = '#ancients/' + x; }, fk.id);
      await page.waitForFunction(() => document.querySelector('#panel .fieldkey'));
      if ((await page.locator('#panel .fieldkey dt').count()) !== 5) fail('the field key does not show five questions');
      await page.locator('#panel .more-btn').last().click();
      await page.waitForFunction(x => document.querySelector('.role-centre')?.dataset.id === x, fk.id);
    }
    for (const bad of ['constructor', '__proto__', 'no-such-name']) {
      await page.evaluate(x => { location.hash = '#ancients/' + x; }, bad);
      await page.waitForFunction(() => document.querySelector('#stage').dataset.view === 'ancients' && !document.querySelector('#panel .back'));
    }
    await page.locator('#tab-ideals').click();
    await page.waitForFunction(() => document.querySelector('#stage').dataset.view === 'overview');
  }

  // Offshoots come forward: each is listed on the overview and, where it came out of a carrier, drawn in that ideal's
  // view; its panel says why it is not an ideal.
  for (const o of graph.offshoots || []) {
    await page.evaluate(() => { location.hash = ''; });
    await page.waitForFunction(() => document.querySelector('#stage').dataset.view === 'overview');
    const btn = page.locator(`#panel [data-offshoot="${o.id}"]`);
    if (!(await btn.count())) fail(`offshoot ${o.id} is not listed on the overview`);
    else {
      await btn.click();
      await page.waitForFunction(() => document.querySelector('#panel .kicker')?.textContent === 'Offshoot');
      if (!(await page.locator('#panel .loop').allTextContents()).some(t => t.startsWith('Why it is not an ideal'))) fail(`offshoot ${o.id}: no reason given on the overview`);
      const want = graph.edges.filter(e => (e.from === o.id || e.to === o.id) && e.type !== 'breaks_from').length;
      const got = await page.locator('#panel section', { has: page.locator('h3', { hasText: 'Other links on the record' }) }).locator('li').count();
      if (got < want) fail(`offshoot ${o.id}: its panel lists ${got} of ${want} other links`);
    }
    const fromCarrier = graph.edges.some(e => e.from === o.id && e.type === 'breaks_from' && graph.carriers.some(c => c.id === e.to));
    if (!fromCarrier) continue;
    let seen = false;
    for (const d of graph.ideals) {
      await page.evaluate(id => { location.hash = '#' + id; }, d.id);
      await page.waitForFunction(id => document.querySelector('.role-centre')?.dataset.id === id, d.id);
      const mark = page.locator(`#map .node-offshoot[data-id="${o.id}"]`);
      if (await mark.count()) {
        seen = true;
        await mark.click();
        const k = await page.locator('#panel .kicker').first().textContent();
        if (k !== 'Offshoot') fail(`an offshoot's panel shows "${k}"`);
        if (!(await page.locator('#panel .loop').allTextContents()).some(t => t.startsWith('Why it is not an ideal'))) fail(`offshoot ${o.id}: no reason given`);
        if (shots) await page.screenshot({ path: path.join(shots, 'offshoot-light.png'), fullPage: true });
        break;
      }
    }
    if (!seen) fail(`offshoot ${o.id} came out of a carrier and is never drawn`);
  }
  await page.evaluate(() => { location.hash = ''; });
  await page.waitForFunction(() => document.querySelector('#stage').dataset.view === 'overview');

  if (!anyDropped) {
    // Exempt: an alleged event (listed in its name's panel, never drawn) and a name whose only links are to the
    // ancients view (drawn there or listed on a pattern's or a mechanism's panel).
    const ancientOnly = id => (graph.edges.filter(e => e.from === id || e.to === id)).every(e => ['invokes', 'uses', 'reads_as'].includes(e.type));
    const histEv = new Set(graph.edges.filter(e => e.type === 'bears_fruit' && graph.carriers.some(c => c.historical && c.id === e.from)).map(e => e.to));
    const all = [...graph.ideals, ...graph.carriers, ...graph.vehicles, ...graph.fruits.filter(f => f.kind !== 'alleged' && !histEv.has(f.id)), ...graph.texts, ...moneyNodes]
      .map(n => n.id).filter(id => !ancientOnly(id));
    const missing = all.filter(x => !everDrawn.has(x));
    if (missing.length) fail(`never drawn in any focus view: ${missing.join(', ')}`);
  }
  // An alleged event is listed in its name's panel and never drawn (spec section 9); nor are a historical carrier's events.
  {
    const historical = new Set(graph.carriers.filter(c => c.historical).map(c => c.id));
    const histFruit = new Set(graph.edges.filter(e => e.type === 'bears_fruit' && historical.has(e.from)).map(e => e.to));
    const shownAlleged = graph.fruits.filter(f => f.kind === 'alleged' && drawnInFocus.has(f.id)).map(f => f.id);
    if (shownAlleged.length) fail(`an alleged event is drawn: ${shownAlleged.join(', ')}`);
    const shownHist = [...histFruit].filter(id => drawnInFocus.has(id));
    if (shownHist.length) fail(`a historical carrier's event is drawn in an ideal's view: ${shownHist.join(', ')}`);
  }

  // The crowded ideal: screenshots in both themes, click a carrier, an edge, and go back.
  const first = graph.ideals[0].id;
  await page.evaluate(id => { location.hash = '#' + id; }, first);
  await page.waitForFunction(id => document.querySelector('.role-centre')?.dataset.id === id, first);
  if (shots) await page.screenshot({ path: path.join(shots, 'focus-light.png'), fullPage: true });
  await page.locator('#map .node-carrier').first().click();
  const kicker = await page.locator('#panel .kicker').first().textContent();
  if (kicker !== 'Carrier') fail(`clicking a carrier shows "${kicker}"`);
  await page.locator('#panel .back').click();
  await page.locator('#panel .linkbtn').first().click();
  if (!(await page.locator('#map .edge.is-selected').count())) fail('choosing a link sentence does not highlight an edge');
  await page.locator('#panel .back').click();

  // Keyboard: focus a rim ideal and press Enter.
  const rim = page.locator('#map .role-rim').first();
  if (await rim.count()) {
    const target = await rim.getAttribute('data-id');
    await rim.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(id => document.querySelector('.role-centre')?.dataset.id === id, target);
  }

  // Theme toggle and the overview button.
  await page.locator('#theme').click();
  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (theme !== 'dark') fail(`theme toggle gave "${theme}"`);
  if (shots) await page.screenshot({ path: path.join(shots, 'focus-dark.png'), fullPage: true });
  await page.locator('#to-overview').click();
  await page.waitForFunction(() => document.querySelector('#stage').dataset.view === 'overview');
  if (shots) await page.screenshot({ path: path.join(shots, 'overview-dark.png'), fullPage: true });

  // List view holds every node and link.
  await page.locator('.listview summary').click();
  const rows = await page.locator('#tables tbody tr').count();
  const want = graph.ideals.length + graph.carriers.length + graph.vehicles.length + graph.fruits.length + graph.texts.length + graph.edges.length +
    ((graph.patterns || []).length || (graph.offshoots || []).length ? (graph.patterns || []).length + (graph.mechanisms || []).length + (graph.offshoots || []).length : 0) +
    (flows.length ? moneyNodes.length : 0);
  if (rows !== want) fail(`list view has ${rows} rows, expected ${want}`);

  // The way in: the guide, the timeline, and search.
  await page.locator('#to-start').click();
  await page.waitForFunction(() => location.hash === '#start' && !document.getElementById('the-page').hidden);
  if (!(await page.locator('#the-page .glossary dt').count())) fail('Start here shows no glossary');
  if (!(await page.locator('#layout').isHidden())) fail('the map stays visible under Start here');
  const prog = await page.locator('#the-page .progress').textContent();
  if (!/re-read 1 of the \d+ pages/.test(prog || '')) fail(`Start here progress line reads "${prog}"`);
  await page.locator('#tab-timeline').click();
  await page.waitForFunction(() => location.hash === '#timeline');
  const tl = await page.locator('#the-page .tl-item').count();
  const dated = graph.fruits.length + (graph.watch || []).length;
  if (tl !== dated) fail(`timeline shows ${tl} items, data has ${dated} dated events and claims`);
  await page.locator('#the-page .tl-filters select').first().selectOption('claim');
  const claims = await page.locator('#the-page .tl-item').count();
  if (claims !== (graph.watch || []).length) fail(`timeline filtered to claims shows ${claims}, Watch has ${(graph.watch || []).length}`);
  if ((await page.locator('#the-page .badge-reread').count()) !== 0) fail('a claim carries a person re-read badge it was not given');
  await page.locator('#the-page .tl-filters select').first().selectOption('event');
  if (!(await page.locator('#the-page .badge-reread').count())) fail('the re-read page shows no person re-read badge on the timeline');
  const tlFirst = await page.locator('#the-page .tl-title').first().textContent();
  await page.locator('#the-page .tl-title').first().click();
  await page.waitForFunction(() => location.hash.indexOf('#r/') === 0);
  const recTitle = await page.locator('#the-page .rec-title').textContent();
  if (recTitle !== tlFirst) fail(`choosing "${tlFirst}" on the timeline opened the record "${recTitle}"`);
  if (!(await page.locator('#the-page .trail .trail-step').count())) fail('a record shows no trail');
  await page.locator('#the-page .rec-actions button').first().click();
  if (await page.locator('#the-page').isVisible()) fail('"See it on the map" does not leave the record for the map');
  const target = graph.carriers[0];
  await page.locator('#search').fill(target.label.slice(0, 12));
  await page.waitForSelector('#search-hits:not([hidden]) li');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const opened = await page.locator('#the-page .rec-title').textContent();
  if (opened !== target.label) fail(`search for "${target.label}" opened the record "${opened}"`);
  await page.locator('#search').fill('claim in circ');
  await page.waitForSelector('#search-hits:not([hidden]) li');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash === '#watch/claim-1');

  // Ways in: the door strip on the front opens a door; its stops lead to records and views.
  await page.evaluate(() => { location.hash = ''; });
  await page.waitForSelector('#doors:not([hidden]) .door-chip');
  if ((await page.locator('#doors .door-chip').count()) !== graph.doors.length) fail('the front does not show one chip per door');
  await page.locator('#doors .door-chip').first().click();
  await page.waitForFunction(() => location.hash === '#door/sample-door');
  if ((await page.locator('#the-page .door-stops li').count()) !== graph.doors[0].stops.length) fail('a door does not list its stops');
  await page.locator('#the-page .door-go').nth(1).click();
  await page.waitForFunction(() => location.hash === '#methods');
  // Alignment methods side by side, and a method's own record with its five questions.
  if ((await page.locator('#the-page .mk-table tbody tr').count()) !== graph.methods.length) fail('the methods table does not list every method');
  await page.locator('#the-page .mk-name .linkbtn').first().click();
  await page.waitForFunction(() => location.hash === '#r/sample-method');
  if ((await page.locator('#the-page .mk-key dt').count()) !== 5) fail('a method record does not answer the five questions');
  await page.evaluate(() => { location.hash = '#r/lab-0'; });
  await page.waitForFunction(() => /Alignment methods it pushes/.test(document.getElementById('the-page').textContent));

  // A record: one page shape for anything. An ideal's page says where it stands; a person with an entry opens it.
  await page.evaluate(() => { location.hash = '#r/ideal-0'; });
  await page.waitForSelector('#the-page .rec-phases li');
  if ((await page.locator('#the-page .rec-phases li').count()) !== 6) fail('an ideal record does not list its six phases');
  if (!(await page.locator('#the-page .rec-list li').count())) fail('an ideal record lists nothing it links to');
  await page.evaluate(() => { location.hash = '#r/sample-speaker'; });
  await page.waitForFunction(() => (document.querySelector('#the-page .rec-who') || {}).textContent);
  const pr = await page.locator('#the-page .rec-title').textContent();
  if (pr !== graph.carriers[0].label) fail(`a person with an entry opened "${pr}", not their entry`);
  await page.evaluate(() => { location.hash = '#ideal-0'; });
  await page.waitForSelector('#panel .as-page');
  await page.locator('#panel .as-page').click();
  await page.waitForFunction(() => location.hash === '#r/ideal-0');

  // Who's who: a named person is marked where the name appears, and the mark opens a plain card.
  await page.evaluate(() => { location.hash = '#ideal-0'; });
  await page.waitForSelector('#panel .who[data-who="sample-speaker"]');
  await page.locator('#panel .who[data-who="sample-speaker"]').first().click();
  await page.waitForSelector('#who-card:not([hidden])');
  const card = await page.locator('#who-card').textContent();
  if (!/A sample public figure/.test(card || '')) fail(`who card reads "${card}"`);
  await page.keyboard.press('Escape');
  if (await page.locator('#who-card').isVisible()) fail('Escape does not close the who card');
  if (!(await page.locator('#to-people').isVisible())) fail("the Who's who link is not shown");
  await page.locator('#to-people').click();
  await page.waitForFunction(() => location.hash === '#people');
  if ((await page.locator('#the-page .people dt').count()) !== 1) fail("Who's who does not list the fixture's one person");

  // Narrow screen: no page-level horizontal scroll.
  await page.setViewportSize({ width: 390, height: 800 });
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (scroll > 1) fail(`page scrolls sideways by ${scroll}px at 390px wide`);
  if (shots) await page.screenshot({ path: path.join(shots, 'narrow.png') });

  await browser.close();
  if (errors.length) { console.log('FAIL'); errors.forEach(e => console.log(' -', e)); process.exit(1); }
  console.log(`PASS: ${graph.ideals.length} ideals, ${flows.length} money records, ${want} rows in the list view, worst label overlap ${worst}`);
})();
