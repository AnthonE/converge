/* Ideals Map: the money and evaluators view.
   Overview: money moves left to right across three columns (sources, bodies in between,
   recipients and evaluators). Pick a name and the view turns to that name alone: who pays,
   hosts or evaluates it on the left, and what it pays, hosts or evaluates on the right.
   An evaluator's link to a company it tests is dash-dotted, so "the evaluated pays the
   evaluator" shows as two lines between the same two names. The view states flows and stops. */
(function (ns) {
  'use strict';

  var MONEY = { funds: true, evaluates: true, hosts: true };
  var VERB = { funds: 'funds', evaluates: 'evaluates', hosts: 'hosts' };
  var MAX = 20, COLS = [300, 700, 1100], MID = 415;
  ns.isMoney = function (e) { return MONEY[e.type] === true; };
  ns.hasMoney = function (ix, id) {
    return Array.isArray(ix.adj[id]) && ix.adj[id].some(function (l) { return ns.isMoney(l.edge); });
  };
  function moneyEdges(ix) {
    return ix.g.edges.filter(function (e) { return ns.isMoney(e) && ix.byId[e.from] && ix.byId[e.to]; });
  }
  function name(n) { return n.label || n.ref; }
  function byName(a, b) { return name(a).localeCompare(name(b)); }

  /* One drawn line per (from, to, type). Lines between the same two names are bowed apart. */
  function lines(ix, edges, pos) {
    var seen = {}, list = [], pairs = {};
    edges.forEach(function (e) {
      if (!pos[e.from] || !pos[e.to]) return;
      var k = e.from + '>' + e.to + '>' + e.type;
      if (seen[k]) { seen[k].count++; return; }
      seen[k] = { edge: e, count: 1 }; list.push(seen[k]);
      var p = [e.from, e.to].sort().join('|');
      (pairs[p] = pairs[p] || []).push(seen[k]);
    });
    Object.keys(pairs).forEach(function (p) {
      pairs[p].forEach(function (l, i) { l.bow = (i - (pairs[p].length - 1) / 2) * 26; });
    });
    return list.map(function (l) {
      var e = l.edge, a = pos[e.from], b = pos[e.to], d;
      if (a.x === b.x) {
        /* Same column: arc away from the side the labels are on. */
        var k = a.bulge * (60 + Math.min(70, Math.abs(a.y - b.y) / 4)) + l.bow;
        d = 'M' + a.x + ',' + a.y + ' C' + (a.x + k) + ',' + a.y + ' ' + (b.x + k) + ',' + b.y + ' ' + b.x + ',' + b.y;
      } else {
        var mx = (a.x + b.x) / 2;
        d = 'M' + a.x + ',' + a.y + ' C' + mx + ',' + (a.y + l.bow) + ' ' + mx + ',' + (b.y + l.bow) + ' ' + b.x + ',' + b.y;
      }
      var tip = l.count > 1 ? name(ix.byId[e.from]) + ' ' + VERB[e.type] + ' ' + name(ix.byId[e.to]) + ' (' + l.count + ' records)' : e.sentence;
      return { edge: e, a: a, b: b, d: d, tip: tip };
    });
  }

  function column(list, x, side, pos, nodes, role) {
    var step = list.length > 1 ? Math.min(36, 690 / (list.length - 1)) : 0;
    var top = MID - step * (list.length - 1) / 2;
    list.forEach(function (n, i) {
      pos[n.id] = { x: x, y: top + i * step, bulge: side === 'left' ? 1 : -1 };
      nodes.push({ node: n, x: x, y: top + i * step, role: role, side: side });
    });
  }
  function capped(list, state) {
    state.dropped += Math.max(0, list.length - MAX);
    return list.slice(0, MAX);
  }

  function overview(ix) {
    /* An allegation stays in the panel. It is never drawn or counted on a line (spec section 8, guardrail 4). */
    var E = moneyEdges(ix).filter(function (e) { return e.kind !== 'alleged'; }), st = {};
    function at(id) { return st[id] = st[id] || { gives: 0, gets: 0, deg: 0 }; }
    E.forEach(function (e) {
      at(e.from).deg++; at(e.to).deg++;
      if (e.type !== 'evaluates') { at(e.from).gives++; at(e.to).gets++; }
    });
    var cols = [[], [], []];
    Object.keys(st).forEach(function (id) {
      var n = ix.byId[id], s = st[id];
      var c = n.type === 'evaluator' ? 2 : n.type === 'lab' ? 1 : s.gives && s.gets ? 1 : s.gives ? 0 : s.gets ? 2 : 1;
      cols[c].push(n);
    });
    var state = { dropped: 0 }, shown = {};
    cols = cols.map(function (list) {
      list.sort(function (a, b) { return (st[b.id].deg - st[a.id].deg) || byName(a, b); });
      var keep = capped(list, state).sort(byName);
      keep.forEach(function (n) { shown[n.id] = true; });
      return keep;
    });
    /* A name whose only partners did not fit would stand with no line. Leave it to the list, count it,
       and lay out the rest so the columns have no gaps. */
    var tiedTo = {};
    E.forEach(function (e) { if (shown[e.from] && shown[e.to]) tiedTo[e.from] = tiedTo[e.to] = true; });
    var pos = {}, nodes = [];
    cols.forEach(function (list, c) {
      var keep = list.filter(function (n) { return tiedTo[n.id] === true; });
      state.dropped += list.length - keep.length;
      column(keep, COLS[c], c === 0 ? 'left' : 'right', pos, nodes, 'money');
    });
    var captions = [
      { text: 'Pays, pledges or hosts', x: COLS[0] - 30, y: 30, anchor: 'end' },
      { text: 'In between', x: COLS[1] - 16, y: 30 },
      { text: 'Paid, hosted or evaluating', x: COLS[2] - 16, y: 30 }
    ].filter(function (c, i) { return cols[i].length; });
    return { nodes: nodes, edges: lines(ix, E, pos), dropped: state.dropped, captions: captions, quiet: true, money: true };
  }

  function focusOn(ix, id) {
    /* An allegation stays in the panel. It places no name and draws no line (spec section 8, guardrail 4). */
    var E = moneyEdges(ix).filter(function (e) { return e.kind !== 'alleged'; }), left = {}, right = {};
    E.forEach(function (e) {
      if (e.type === 'evaluates' || e.from === e.to) return;
      if (e.to === id) left[e.from] = true; else if (e.from === id) right[e.to] = true;
    });
    /* A name on both sides stays on the paying side. Its side then gives the direction of only one of its lines, so the view says so. */
    var both = false;
    Object.keys(left).forEach(function (k) { if (right[k]) both = true; delete right[k]; });
    E.forEach(function (e) {
      if (e.type !== 'evaluates' || e.from === e.to) return;
      if (e.to === id) { if (right[e.from]) both = true; else left[e.from] = true; }
      if (e.from === id) { if (left[e.to]) both = true; else right[e.to] = true; }
    });
    function side(set) { return Object.keys(set).map(function (k) { return ix.byId[k]; }).sort(byName); }
    var pos = {}, nodes = [], state = { dropped: 0 }, L = side(left), R = side(right);
    pos[id] = { x: COLS[1], y: MID, bulge: -1 };
    nodes.push({ node: ix.byId[id], x: COLS[1], y: MID, role: 'money-centre' });
    column(capped(L, state), COLS[0], 'left', pos, nodes, 'money');
    column(capped(R, state), COLS[2], 'right', pos, nodes, 'money');
    var captions = [];
    if (L.length) captions.push({ text: 'Pays, hosts or evaluates it', x: COLS[0] - 30, y: 30, anchor: 'end' });
    if (R.length) captions.push({ text: 'It pays, hosts or evaluates', x: COLS[2] - 16, y: 30 });
    if (both) captions.push({ text: 'A name joined both ways: the panel gives each direction', x: COLS[1], y: 30, anchor: 'middle' });
    return { nodes: nodes, edges: lines(ix, E, pos), dropped: state.dropped, centre: id, captions: captions, money: true };
  }

  ns.money = function (ix, selected) { return ns.hasMoney(ix, selected) ? focusOn(ix, selected) : overview(ix); };

  /* ---- side panel ---- */

  function flowLine(ui, ix, e, otherId) {
    var li = ui.h('li', 'flow');
    if (otherId) {
      var b = ui.h('button', 'linkbtn', name(ix.byId[otherId]));
      b.type = 'button';
      b.addEventListener('click', function () { ui.select(otherId); });
      ui.add(li, b);
    } else {
      ui.add(li, ui.h('strong', null, name(ix.byId[e.from]) + ' ' + VERB[e.type] + ' ' + name(ix.byId[e.to])));
    }
    var facts = [e.amount, e.date].filter(Boolean).join(', ');
    ui.add(li, ui.h('span', null, facts ? ' — ' + facts + '. ' : '. '), ui.h('span', null, e.sentence + ' '));
    if (e.source) ui.add(li, ui.link(e.url, e.source, e.nolink), ui.h('span', null, ' '));
    if (e.kind) ui.add(li, ui.h('span', 'lane', e.kind), ui.h('span', null, ' '));
    if (e.verified) ui.add(li, ui.badge(e.verified, e.url));
    return li;
  }
  function newestFirst(a, b) { return String(b.date || '').localeCompare(String(a.date || '')); }
  function flowSection(ui, ix, title, edges, end) {
    if (!edges.length) return null;
    var ul = ui.h('ul', 'links');
    edges.sort(newestFirst).forEach(function (e) { ui.add(ul, flowLine(ui, ix, e, e[end])); });
    return ui.add(ui.section(title + ' (' + edges.length + ')'), ul);
  }
  function unique(list) { return list.filter(function (x, i) { return list.indexOf(x) === i; }); }

  ns.moneyPanel = function (ix, n, ui) {
    var root = ui.h('div'), E = moneyEdges(ix);
    function of(type, end) { return E.filter(function (e) { return e.type === type && e[end] === n.id; }); }
    ui.add(root, ui.h('p', 'kicker', n.type === 'carrier' && n.kind ? n.kind.charAt(0).toUpperCase() + n.kind.slice(1) : ns.nodeWord(n)), ui.h('h2', null, name(n)));
    if (n.status) ui.add(root, ui.h('p', 'cite', n.status));
    if (n.note) ui.add(root, ui.h('p', null, n.note));

    /* A plain statement when the same two names are tied by payment and by evaluation. */
    var pays = {}, paidBy = {};
    /* An allegation is not a record: it never makes or completes the pair. */
    function rec(type, end) { return of(type, end).filter(function (e) { return e.kind !== 'alleged'; }); }
    rec('funds', 'from').forEach(function (e) { pays[e.to] = true; });
    rec('funds', 'to').forEach(function (e) { paidBy[e.from] = true; });
    var tests = unique(rec('evaluates', 'from').filter(function (e) { return paidBy[e.to]; }).map(function (e) { return name(ix.byId[e.to]); }));
    var testedBy = unique(rec('evaluates', 'to').filter(function (e) { return pays[e.from]; }).map(function (e) { return name(ix.byId[e.from]); }));
    var tail = ' The records are listed below. This is a fact about the arrangement, not a finding about the work.';
    if (tests.length) ui.add(root, ui.h('p', 'loop', 'Both links are on record: this body evaluates ' + tests.join(', ') +
      ', and a record of money, investment or commissioned work runs from ' + (tests.length > 1 ? 'them' : 'it') + ' to this body.' + tail));
    if (testedBy.length) ui.add(root, ui.h('p', 'loop', 'Both links are on record: a record of money, investment or commissioned work runs from this company to ' +
      testedBy.join(', ') + ', which also evaluate' + (testedBy.length > 1 ? '' : 's') + ' it.' + tail));
    if (n.policy) ui.add(root, ui.add(ui.section('In its own words: money, access and independence'), ui.quoteList([n.policy])));

    if ((n.disputes || []).length) {
      var ds = ui.section('Episodes on record', 'Each is tagged documented, reported or alleged, and carries the published response where one was found.');
      var dl = ui.h('ul', 'links');
      n.disputes.forEach(function (d) {
        var li = ui.h('li', 'dispute');
        ui.add(li, ui.h('span', null, d.date + ': ' + d.what + ' '),
          ui.h('span', null, d.response ? 'Response: ' + d.response + ' ' : d.kind === 'documented' ? '' : 'No response is recorded here. '),
          ui.link(d.url, d.source, d.nolink), ui.h('span', null, ' '), ui.h('span', 'lane', d.kind), ui.h('span', null, ' '), ui.badge(d.verified, d.url));
        ui.add(dl, li);
      });
      ui.add(root, ui.add(ds, dl));
    }

    ui.add(root,
      flowSection(ui, ix, 'Paid, funded or commissioned by', of('funds', 'to'), 'from'),
      flowSection(ui, ix, 'Pays, funds or commissions', of('funds', 'from'), 'to'),
      flowSection(ui, ix, 'Evaluates', of('evaluates', 'from'), 'to'),
      flowSection(ui, ix, 'Evaluated by', of('evaluates', 'to'), 'from'),
      flowSection(ui, ix, 'Hosts', of('hosts', 'from'), 'to'),
      flowSection(ui, ix, 'Hosted by', of('hosts', 'to'), 'from'));

    if ((n.words || []).length) ui.add(root, ui.add(ui.section('Quoted words', 'Each line names its speaker.'), ui.quoteList(n.words)));

    var happened = ix.adj[n.id].filter(function (l) { return l.edge.type === 'bears_fruit' && l.edge.from === n.id; })
      .map(function (l) { return ix.byId[l.other]; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    if (happened.length) {
      var hs = ui.section('What happened (' + happened.length + ')'), hl = ui.h('ul', 'links');
      happened.forEach(function (f) {
        var li = ui.h('li', 'dispute');
        li.setAttribute('data-event', f.id);
        ui.add(li, ui.h('span', null, f.date + ': ' + f.what + ' '), ui.link(f.url, f.source || 'source', f.nolink), ui.h('span', null, ' '),
          ui.h('span', 'lane', f.kind), ui.h('span', null, ' '), ui.badge(f.verified, f.url));
        ui.add(hl, li);
      });
      ui.add(root, ui.add(hs, hl));
    }

    /* Where the names it pays or hosts sit on the ideals map. One step only, and no inference. */
    var seenIdeal = {}, via = [];
    of('funds', 'from').concat(of('hosts', 'from')).forEach(function (e) {
      ix.adj[e.to].forEach(function (l) {
        if (l.edge.type !== 'carries' || l.edge.from !== e.to) return;
        var k = e.to + '>' + l.other;
        if (seenIdeal[k]) return;
        seenIdeal[k] = true; via.push({ who: ix.byId[e.to], ideal: ix.byId[l.other] });
      });
    });
    if (via.length) {
      var vs = ui.section('Where its recipients sit on the ideals map', 'A recipient that carries an ideal does not make its funder a carrier of it.');
      var vl = ui.h('ul', 'links');
      via.forEach(function (x) {
        var b = ui.h('button', 'linkbtn', name(x.who) + ' carries \u201c' + x.ideal.label + '\u201d'), li = ui.h('li', 'via');
        b.type = 'button';
        b.addEventListener('click', function () { ui.go(x.ideal.id); });
        ui.add(vl, ui.add(li, b));
      });
      ui.add(root, ui.add(vs, vl));
    }

    var ideals = ix.adj[n.id].filter(function (l) { return ix.byId[l.other].type === 'ideal'; });
    if (ideals.length) {
      var is = ui.section('On the ideals map'), il = ui.h('ul', 'links');
      ideals.forEach(function (l) {
        var b = ui.h('button', 'linkbtn', l.edge.sentence), li = ui.h('li');
        b.type = 'button';
        b.addEventListener('click', function () { ui.go(l.other); });
        ui.add(il, ui.add(li, b, l.edge.lens ? ui.h('span', 'lane', 'lens') : null));
      });
      ui.add(root, ui.add(is, il));
    }
    var m = ix.g.meta || {};
    if (m.money_note) ui.add(root, ui.h('p', 'note', m.money_note));
    if (m.disclosure) ui.add(root, ui.h('p', 'loop', 'Disclosure: ' + m.disclosure));
    return root;
  };

  /* Every record between the two names of a chosen line, in both directions. */
  ns.moneyEdgePanel = function (ix, e, ui) {
    var root = ui.h('div'), ul = ui.h('ul', 'links');
    var both = moneyEdges(ix).filter(function (x) {
      return (x.from === e.from && x.to === e.to) || (x.from === e.to && x.to === e.from);
    }).sort(newestFirst);
    ui.add(root, ui.h('p', 'kicker', 'Between two names'), ui.h('h2', null, name(ix.byId[e.from]) + ' and ' + name(ix.byId[e.to])));
    both.forEach(function (x) { ui.add(ul, flowLine(ui, ix, x, null)); });
    ui.add(root, ul, ui.h('p', 'note', 'Funding is not endorsement, and a record of payment is not a finding about anyone’s work.'));
    var m = ix.g.meta || {};
    if (m.money_note) ui.add(root, ui.h('p', 'note', m.money_note));
    if (m.disclosure) ui.add(root, ui.h('p', 'loop', 'Disclosure: ' + m.disclosure));
    return root;
  };

  ns.moneyIntro = function (ix, ui) {
    var root = ui.h('div'), m = ix.g.meta || {};
    ui.add(root, ui.h('p', 'kicker', 'How to read this'), ui.h('h2', null, 'Money and evaluators'),
      ui.h('p', null, 'Records run from left to right. On the left are those named as paying, investing, lending, pledging or hosting. On the right are those named as receiving or hosted, and the evaluators. In between are the AI companies and the bodies that receive and pass on, or that recommend grants for their funders. A line is a record: some are pledges or letters of intent, not payments.'),
      ui.h('p', null, 'Pick any name. The map turns to that name alone, and this panel lists each record with its amount, date and source.'),
      ui.h('p', null, 'A dash-dotted line runs from an evaluator to a company it tests or scores. An allegation is listed in a name’s panel and is never drawn as a line. Where a solid line also joins the same two names, a record of money, investment or commissioned work is on file between them, and the panel says so. No second line means only that this search found no such public record.'),
      ui.h('p', 'note', 'Why this is here: to weigh a witness’s report, a reader first needs to know who pays the witness. That is an old rule of audit and not a finding of this project. Funding is not endorsement, and neither is renting out a venue. Nothing here judges anyone’s work or motive.'));
    if (m.money_note) ui.add(root, ui.h('p', 'note', m.money_note));
    if (m.disclosure) ui.add(root, ui.h('p', 'loop', 'Disclosure: ' + m.disclosure));
    return root;
  };
})(window.IdealsMap = window.IdealsMap || {});
