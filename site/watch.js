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
  ns.rereadMark = function (ui, ix, w) { return rereadMark(ui, ix, w); };
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

  /* How far a person has re-read the pages this claim cites; until then the claim says so. */
  function rereadMark(ui, ix, w) {
    var urls = {};
    (function walk(o) {
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (!o || typeof o !== 'object') return;
      if (typeof o.url === 'string' && /^https?:\/\//.test(o.url)) urls[o.url] = true;
      Object.keys(o).forEach(function (k) { if (k !== 'url') walk(o[k]); });
    })(w);
    var all = Object.keys(urls), done = all.filter(function (u) { var r = (ix.reread || {})[u]; return r && /^(holds|corrected)$/.test(r.result); }).length;
    if (!all.length) return null;
    return ui.h('span', 'lane reread-mark' + (done === all.length ? ' is-done' : ''),
      done === all.length ? 're-read by a person' : done ? 're-read by a person: ' + done + ' of ' + all.length + ' sources' : 'not yet re-read by a person');
  }

  function item(ui, w, ix, onNode) {
    var art = ui.h('article', 'claim');
    art.id = 'watch-' + w.id;
    var head = ui.h('header', 'claim-head');
    ui.add(head, ui.h('time', null, w.date), ui.h('span', 'claim-status status-' + w.status.replace(/ /g, '-'), STATUS[w.status] || w.status),
      ui.h('span', 'lane', w.kind), rereadMark(ui, ix, w));
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
          c.url ? ui.link(c.url, c.source, c.nolink) : ui.h('span', 'cite', '(' + (c.source || '') + ')'), ui.h('span', null, ' '), c.verified ? ui.badge(c.verified, c.url) : null);
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
    ui.add(art, ns.recordFoot(ix, ui, { id: w.id, title: w.title, hash: '#watch/' + w.id }));
    return art;
  }

  function count(list, key) {
    var c = {};
    list.forEach(function (w) { [].concat(key(w)).forEach(function (k) { if (k) c[k] = (c[k] || 0) + 1; }); });
    return c;
  }
  function select(ui, label, first, options, value, onChange) {
    var s = ui.h('select'); s.setAttribute('aria-label', label);
    var any = ui.h('option', null, first); any.value = ''; ui.add(s, any);
    options.forEach(function (o) { var op = ui.h('option', null, o[1]); op.value = o[0]; if (value === o[0]) op.selected = true; ui.add(s, op); });
    s.addEventListener('change', onChange);
    return s;
  }

  /* The whole Watch, newest first. Claims in one thread are shown together, folded, under a note that says why
     they are here; a filter narrows by status or by the name on the map a claim touches. */
  ns.renderWatch = function (box, ix, ui, onNode, filter, focusId) {
    while (box.firstChild) box.removeChild(box.firstChild);
    filter = filter || { status: '', on: '' };
    var m = ix.g.meta || {}, threads = m.watch_threads || {}, all = ix.g.watch || [];
    var intro = ui.h('div', 'watch-intro');
    ui.add(intro, ui.h('h2', null, 'The Watch'),
      ui.h('p', null, 'Claims in circulation about AI, the people building it and the events around them, each dated, with who is speaking and what has been checked so far. This is a timeline of claims and evidence, not a verdict. A claim here is not a finding, and an unchecked claim is not false. Follow the sources and come to your own conclusion.'),
      ui.h('p', 'note', 'Being on the Watch does not put a claim on the map: it joins the map’s records only once its sources are checked. People who are not public figures are not named. ' + (m.made_with || '')));
    if (!document.getElementById('graph-data')) {
      var a = ui.h('a', 'src', 'a feed of new claims and events'); a.href = 'feed.xml';
      ui.add(intro, ui.add(ui.h('p', 'note'), ui.h('span', null, 'To hear of new entries, follow '), a, ui.h('span', null, ' in any feed reader.')));
    }

    var byStatus = count(all, function (w) { return w.status; });
    var byOn = count(all, function (w) { return (w.touches || []).filter(function (id) { return ix.byId[id]; }); });
    function again() { ns.renderWatch(box, ix, ui, onNode, { status: st.value, on: on.value }); }
    var st = select(ui, 'Status', 'Every status', Object.keys(STATUS).filter(function (k) { return byStatus[k]; }).map(function (k) {
      return [k, STATUS[k] + ' (' + byStatus[k] + ')']; }), filter.status, again);
    var on = select(ui, 'On the map', 'Every claim', Object.keys(byOn).sort(function (x, y) { return byOn[y] - byOn[x]; }).map(function (k) {
      return [k, 'Touches ' + (ix.byId[k].label || ix.byId[k].ref) + ' (' + byOn[k] + ')']; }), filter.on, again);
    var shown = all.filter(function (w) {
      return (!filter.status || w.status === filter.status) && (!filter.on || (w.touches || []).indexOf(filter.on) >= 0);
    }).sort(function (x, y) {
      /* Newest first; on the same day a single claim comes before a thread, then by title. */
      return String(y.date).localeCompare(String(x.date)) || (x.thread ? 1 : 0) - (y.thread ? 1 : 0) || x.title.localeCompare(y.title);
    });
    ui.add(intro, ui.add(ui.h('div', 'tl-filters'), st, on, ui.h('span', 'note', shown.length + ' of ' + all.length + ' shown')));
    ui.add(box, intro);

    var done = {};
    shown.forEach(function (w) {
      var t = w.thread && threads[w.thread];
      if (!t) { ui.add(box, item(ui, w, ix, onNode)); return; }
      if (done[w.thread]) return;
      done[w.thread] = true;
      var members = shown.filter(function (x) { return x.thread === w.thread; });
      var sec = ui.h('details', 'w-thread');
      sec.id = 'thread-' + w.thread;
      if (focusId && members.some(function (x) { return x.id === focusId; })) sec.open = true;
      var sum = ui.h('summary');
      var st2 = count(members, function (x) { return STATUS[x.status] || x.status; });
      ui.add(sum, ui.h('span', 'w-thread-k', 'A thread of ' + members.length + (members.length === 1 ? ' claim' : ' claims')),
        ui.h('span', 'w-thread-t', t.title), ui.h('time', null, members[members.length - 1].date + (members.length > 1 && members[0].date !== members[members.length - 1].date ? ' to ' + members[0].date : '')),
        ui.h('span', 'w-thread-s', Object.keys(st2).map(function (k) { return k + ': ' + st2[k]; }).join(' · ')));
      ui.add(sec, sum, ui.h('p', 'w-thread-note', t.note));
      members.forEach(function (x) { ui.add(sec, item(ui, x, ix, onNode)); });
      ui.add(box, sec);
    });
    if (!shown.length) ui.add(box, ui.h('p', 'note', 'No claim on the Watch matches both filters.'));
  };
})(window.IdealsMap = window.IdealsMap || {});
