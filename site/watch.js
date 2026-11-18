/* The Watch: claims being passed around, dated, each with who made it, what has been checked so far, and any
   responses. Not a verdict. A claim here is not a finding, and an unchecked claim is not false. */
(function (ns) {
  'use strict';

  var STATUS = {
    'not checked': 'Not yet checked',
    'partly checked': 'Partly checked',
    'checked': 'Checked: the sources say what the claim says',
    'not supported': 'Checked: the sources read do not support it',
    'source not found': 'No primary source found yet'
  };
  var RESULT = {
    'supports': 'supports', 'partly supports': 'partly supports', 'does not support': 'does not support',
    'not found': 'not found', 'could not read': 'could not be read'
  };
  ns.watchStatus = STATUS;
  ns.hasWatch = function (ix) { return (ix.g.watch || []).length > 0; };

  /* Small multiples for a scored chain: one row per measure, steps in date order, each row on its own scale.
     A dot per step (hover shows the step); a gap where a step has no score. */
  var SVG = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, text) {
    var e = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function chainChart(steps) {
    var rows = [['hedges', 'Hedges', null], ['attribution', 'Attribution (0–4)', 4], ['label', 'Label (0–3)', 3]];
    var n = steps.length, left = 118, right = 12, rowH = 46, top = 8, W = 640, H = top + rows.length * rowH + 26;
    var hmax = Math.max(1, Math.max.apply(null, steps.map(function (s) { return (s.scores || {}).hedges || 0; })));
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chain-chart', role: 'img', 'aria-label': 'Scores along the chain, in date order' });
    var x = function (i) { return left + (n === 1 ? 0 : i * (W - left - right) / (n - 1)); };
    rows.forEach(function (r, ri) {
      var max = r[2] || hmax, y0 = top + ri * rowH + rowH - 10, y1 = top + ri * rowH + 6;
      var y = function (v) { return y0 - (v / max) * (y0 - y1); };
      svg.appendChild(el('text', { x: 0, y: y0 - 4, class: 'cc-label' }, r[1]));
      svg.appendChild(el('line', { x1: left, x2: W - right, y1: y0, y2: y0, class: 'cc-base' }));
      var d = '', pen = false;
      steps.forEach(function (s, i) {
        var v = (s.scores || {})[r[0]];
        if (v === null || v === undefined) { pen = false; return; }
        d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); pen = true;
      });
      if (d) svg.appendChild(el('path', { d: d, class: 'cc-line' }));
      steps.forEach(function (s, i) {
        var v = (s.scores || {})[r[0]];
        if (v === null || v === undefined) return;
        var g = el('g', { class: 'cc-dot' });
        g.appendChild(el('circle', { cx: x(i), cy: y(v), r: 9, class: 'cc-hit' }));
        g.appendChild(el('circle', { cx: x(i), cy: y(v), r: 4 }));
        g.appendChild(el('title', {}, s.date + ', ' + s.who + ': ' + r[1].replace(/ \(.*/, '').toLowerCase() + ' ' + v));
        svg.appendChild(g);
      });
    });
    var yb = H - 8;
    svg.appendChild(el('text', { x: left, y: yb, class: 'cc-axis' }, steps[0].date.slice(0, 7)));
    svg.appendChild(el('text', { x: W - right, y: yb, class: 'cc-axis', 'text-anchor': 'end' }, steps[n - 1].date.slice(0, 7)));
    svg.appendChild(el('text', { x: (left + W - right) / 2, y: yb, class: 'cc-axis', 'text-anchor': 'middle' }, 'steps in date order (not to time scale)'));
    return svg;
  }

  function item(ui, w, ix, onNode) {
    var art = ui.h('article', 'claim');
    art.id = 'watch-' + w.id;
    var head = ui.h('header', 'claim-head');
    ui.add(head, ui.h('time', null, w.date), ui.h('span', 'claim-status status-' + w.status.replace(/ /g, '-'), STATUS[w.status] || w.status),
      ui.h('span', 'lane', w.kind));
    ui.add(art, head, ui.h('h3', null, w.title));
    var said = ui.h('p', 'claim-said');
    ui.add(said, ui.h('span', null, w.claimed_by + ': '), ui.h('q', null, w.claim), ui.h('span', null, ' '),
      ui.link(w.url, w.source, w.nolink));
    ui.add(art, said);
    if (w.standing) ui.add(art, ui.h('p', 'claim-standing', 'Who is speaking: ' + w.standing));
    if (w.why) ui.add(art, ui.h('p', 'claim-why', 'Why this is here: ' + w.why));
    if ((w.travelled || []).length) {
      var ts = ui.section('How it travelled (' + w.travelled.length + ' steps)',
        'Each step in date order: who said it, their words, where they got it, and what changed from the step before. This does not say which version is right.');
      if (w.travelled_summary) ui.add(ts, ui.h('p', 'note step-summary', w.travelled_summary));
      if (w.travelled.some(function (t) { return t.scores; })) ui.add(ts, ui.add(ui.h('figure', 'chain-fig'), chainChart(w.travelled)));
      var tl = ui.h('ol', 'links travelled');
      w.travelled.forEach(function (t) {
        var li = ui.h('li', 'step');
        ui.add(li, ui.h('time', null, t.date), ui.h('span', null, ' ' + t.who + ': '), ui.h('q', null, t.said), ui.h('span', null, ' '),
          t.url ? ui.link(t.url, t.source, t.nolink) : ui.h('span', 'cite', '(' + t.source + ')'), ui.h('span', null, ' '), t.verified ? ui.badge(t.verified) : null);
        if (t.scores) {
          var sc = t.scores, f = function (v, max) { return v === null || v === undefined ? 'n/a' : v + (max ? ' of ' + max : ''); };
          ui.add(li, ui.h('div', 'step-note step-scores', 'Hedges ' + f(sc.hedges) + ' · attribution ' + f(sc.attribution, 4) + ' · label ' + f(sc.label, 3)));
        }
        if (t.cites) ui.add(li, ui.h('div', 'step-note', 'Gives as its source: ' + t.cites));
        if (t.changed) ui.add(li, ui.h('div', 'step-note step-changed', 'What changed: ' + t.changed));
        ui.add(tl, li);
      });
      ui.add(art, ui.add(ts, tl));
    }
    if ((w.checks || []).length) {
      var s = ui.section('What has been checked (' + w.checks.length + ')', 'Each line says what was looked for, where, and what the page said.');
      var ul = ui.h('ul', 'links');
      w.checks.forEach(function (c) {
        var li = ui.h('li', 'check');
        ui.add(li, ui.h('span', 'lane result-' + c.result.replace(/ /g, '-'), RESULT[c.result] || c.result), ui.h('span', null, ' ' + c.what + ' '),
          c.url ? ui.link(c.url, c.source, c.nolink) : ui.h('span', 'cite', '(' + (c.source || '') + ')'), ui.h('span', null, ' '), c.verified ? ui.badge(c.verified) : null);
        ui.add(ul, li);
      });
      ui.add(art, ui.add(s, ul));
    }
    if ((w.responses || []).length) {
      var rs = ui.section('Responses on the record'), rl = ui.h('ul', 'links');
      w.responses.forEach(function (r) {
        ui.add(rl, ui.add(ui.h('li'), ui.h('span', null, r.who + ': ' + r.what + ' '), r.url ? ui.link(r.url, r.source, r.nolink) : ui.h('span', null, r.source || '')));
      });
      ui.add(art, ui.add(rs, rl));
    }
    if ((w.open || []).length) {
      var os = ui.section('Still open'), ol = ui.h('ul');
      w.open.forEach(function (o) { ui.add(ol, ui.h('li', null, o)); });
      ui.add(art, ui.add(os, ol));
    }
    if ((w.cautions || []).length) {
      var cs = ui.section('Read with care'), cl = ui.h('ul');
      w.cautions.forEach(function (c) { ui.add(cl, ui.h('li', null, c)); });
      ui.add(art, ui.add(cs, cl));
    }
    var on = (w.touches || []).filter(function (id) { return ix.byId[id]; });
    if (on.length) {
      var p = ui.h('p', 'claim-on');
      ui.add(p, ui.h('span', null, 'On the map: '));
      on.forEach(function (id, i) {
        var b = ui.h('button', 'linkbtn', ix.byId[id].label || ix.byId[id].ref);
        b.type = 'button';
        b.addEventListener('click', function () { onNode(id); });
        ui.add(p, i ? ui.h('span', null, ', ') : null, b);
      });
      ui.add(art, p);
    }
    return art;
  }

  /* The whole Watch, newest first. */
  ns.renderWatch = function (box, ix, ui, onNode) {
    while (box.firstChild) box.removeChild(box.firstChild);
    var intro = ui.h('div', 'watch-intro');
    ui.add(intro, ui.h('h2', null, 'The Watch'),
      ui.h('p', null, 'Claims being passed around about AI and the people building it, dated, each with who made it and what has been checked so far. This is a timeline of claims and evidence, not a verdict. A claim here is not a finding, and an unchecked claim is not false. Follow the sources and come to your own conclusion.'),
      ui.h('p', 'note', 'A claim moves onto the map only once its sources are checked. People who are not public figures are not named. ' + (((ix.g.meta || {}).made_with) || '')));
    ui.add(box, intro);
    (ix.g.watch || []).slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || a.title.localeCompare(b.title); })
      .forEach(function (w) { ui.add(box, item(ui, w, ix, onNode)); });
  };
})(window.IdealsMap = window.IdealsMap || {});
