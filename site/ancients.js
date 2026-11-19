/* Ideals Map: the ancients view.
   Three columns: what the movements serve (ideals), how it takes hold (mechanisms), and what the
   ancients called it (patterns). A solid line means a carrier of the ideal invokes the pattern in
   its own words. A dotted line is this project's reading, and says where the likeness stops.
   A text can motivate a question. It never confirms a mechanism or a source. */
(function (ns) {
  'use strict';

  var COLS = [345, 730, 1100], MID = 415, MAX = 28;
  var cache = null;
  function name(n) { return n.label || n.ref; }
  function byName(a, b) { return name(a).localeCompare(name(b)); }

  /* Who stands for an ideal here: the ideal, its carriers (not by a reading), and what the ideal itself runs on.
     A vehicle reached only through a carrier is left out: one model can serve many carriers of many ideals, and
     its records would reach ideals no record ties them to. */
  function family(ix, id) {
    var fam = {}; fam[id] = true;
    ix.adj[id].forEach(function (l) {
      if (l.edge.type === 'carries' && l.edge.to === id && !l.edge.lens) fam[l.other] = true;
      if (l.edge.type === 'runs_on' && l.edge.from === id) fam[l.other] = true;
    });
    return fam;
  }

  /* Lines between the columns, each standing for every record behind it. */
  ns.ancientLines = function (ix) {
    if (cache && cache.g === ix.g) return cache.lines;
    var lines = {}, E = ix.g.edges;
    /* One line per kind: a carrier's own words and this project's reading never share a line (spec section 9). */
    function put(a, b, kind, e) {
      var k = 'anc:' + a + '>' + b + ':' + kind;
      var l = lines[k] = lines[k] || { i: k, from: a, to: b, type: kind, lens: kind === 'reads_as', records: [] };
      l.records.push(e);
    }
    (ix.g.ideals || []).forEach(function (d) {
      var fam = family(ix, d.id);
      E.forEach(function (e) {
        if (!ix.byId[e.to]) return;
        var t = ix.byId[e.to].type;
        /* Words are drawn to an ideal only when the curation says they are about it (the edge's "about"). */
        if (e.type === 'invokes' && t === 'pattern') { if (e.about === d.id) put(d.id, e.to, 'invokes', e); }
        else if (e.type === 'reads_as' && t === 'pattern' && e.from === d.id) put(d.id, e.to, 'reads_as', e);
        /* An alleged use is listed in the panel and never drawn. */
        else if (e.type === 'uses' && t === 'mechanism' && fam[e.from] && e.kind !== 'alleged') put(d.id, e.to, 'uses', e);
      });
    });
    E.forEach(function (e) {
      if (e.type === 'reads_as' && ix.byId[e.from] && ix.byId[e.from].type === 'mechanism' && ix.byId[e.to]) put(e.from, e.to, 'reads_as', e);
    });
    var list = Object.keys(lines).map(function (k) { return lines[k]; });
    list.forEach(function (l) {
      l.sentence = name(ix.byId[l.from]) + ' and ' + name(ix.byId[l.to]) + ': ' + l.records.length + (l.records.length === 1 ? ' record' : ' records');
    });
    cache = { g: ix.g, lines: list, byKey: lines };
    return list;
  };
  ns.ancientLine = function (ix, key) { ns.ancientLines(ix); return cache.byKey[key]; };
  ns.hasAncients = function (ix) { return (ix.g.patterns || []).length > 0; };
  ns.hasAncientLinks = function (ix, id) {
    return Array.isArray(ix.adj[id]) && ix.adj[id].some(function (l) { return /^(invokes|uses|reads_as)$/.test(l.edge.type); });
  };

  function column(list, x, side, pos, nodes) {
    var step = list.length > 1 ? Math.min(36, 690 / (list.length - 1)) : 0;
    var top = MID - step * (list.length - 1) / 2;
    list.forEach(function (n, i) {
      pos[n.id] = { x: x, y: top + i * step };
      nodes.push({ node: n, x: x, y: top + i * step, role: 'ancient', side: side });
    });
  }

  ns.ancients = function (ix, selected) {
    var L = ns.ancientLines(ix), deg = {};
    L.forEach(function (l) { deg[l.from] = (deg[l.from] || 0) + 1; deg[l.to] = (deg[l.to] || 0) + 1; });
    var dropped = 0;
    function cap(list) {
      list.sort(function (a, b) { return ((deg[b.id] || 0) - (deg[a.id] || 0)) || byName(a, b); });
      dropped += Math.max(0, list.length - MAX);
      var keep = list.slice(0, MAX);
      if (selected && list.indexOf(ix.byId[selected]) >= MAX) keep[MAX - 1] = ix.byId[selected];
      return keep.sort(byName);
    }
    var ideals = cap((ix.g.ideals || []).filter(function (d) { return deg[d.id]; }));
    var mechs = cap((ix.g.mechanisms || []).slice());
    var pats = cap((ix.g.patterns || []).slice());
    var pos = {}, nodes = [];
    column(ideals, COLS[0], 'left', pos, nodes);
    column(mechs, COLS[1], 'right', pos, nodes);
    column(pats, COLS[2], 'right', pos, nodes);
    var pairs = {};
    var edges = L.filter(function (l) { return pos[l.from] && pos[l.to]; }).map(function (l) {
      /* Where two kinds join the same pair, the second curve bows apart so both stay visible. */
      var pk = l.from + '>' + l.to, nth = pairs[pk] = (pairs[pk] || 0) + 1, bow = (nth - 1) * 22;
      var a = pos[l.from], b = pos[l.to], mx = (a.x + b.x) / 2;
      var tip = l.sentence + (l.type === 'invokes' ? ' (in their own words)' : l.type === 'reads_as' ? ' (this project’s reading)' : '');
      return { edge: l, a: a, b: b, tip: tip, d: 'M' + a.x + ',' + a.y + ' C' + mx + ',' + (a.y - bow) + ' ' + mx + ',' + (b.y - bow) + ' ' + b.x + ',' + b.y };
    });
    var captions = [
      { text: 'What they serve', x: COLS[0] - 30, y: 30, anchor: 'end' },
      { text: 'How it takes hold', x: COLS[1] - 16, y: 30 },
      { text: 'What the ancients called it', x: COLS[2] - 16, y: 30 }
    ];
    return { nodes: nodes, edges: edges, dropped: dropped, captions: captions, quiet: true, ancients: true, centre: null };
  };

  /* ---- panels ---- */

  function sourceItem(ui, s) {
    var li = ui.h('li', 'source');
    ui.add(li, ui.h('blockquote', null, '“' + s.quote + '”'));
    var c = ui.h('p', 'cite');
    var cite = [s.tradition, s.work + (s.passage ? ' ' + s.passage : ''), s.translation].filter(Boolean).join(' · ');
    ui.add(c, ui.h('span', null, cite + (/[.!?]$/.test(cite) ? ' ' : '. ')),
      ui.link(s.url, 'source', s.nolink), ui.h('span', null, ' '), ui.badge(s.verified, s.url));
    ui.add(li, c);
    if (s.says) ui.add(li, ui.h('p', 'note', s.says));
    return li;
  }

  function recordItem(ui, ix, e, otherId, onOther) {
    var li = ui.h('li', 'flow');
    if (otherId) {
      var o = ix.byId[otherId];
      /* Only what this view draws can be opened here; any other name is shown, not linked. */
      if (/^(ideal|pattern|mechanism)$/.test(o.type)) {
        var b = ui.h('button', 'linkbtn', name(o));
        b.type = 'button';
        b.addEventListener('click', function () { onOther(otherId); });
        ui.add(li, b, ui.h('span', null, '. '));
      } else ui.add(li, ui.h('strong', null, name(o)), ui.h('span', null, '. '));
    }
    if (e.type === 'invokes') {
      ui.add(li, ui.h('span', null, (e.speaker || name(ix.byId[e.from])) + ': '), ui.h('q', null, e.quote), ui.h('span', null, ' '),
        ui.link(e.url, e.source || 'source', e.nolink), ui.h('span', null, e.date ? ' (' + e.date + ') ' : ' '),
        ui.h('span', 'lane', 'own words, ' + e.sense), ui.h('span', null, ' '), ui.badge(e.verified, e.url));
    } else if (e.type === 'reads_as') {
      ui.add(li, ui.h('span', null, e.sentence + ' '), ui.h('span', 'lane', 'this project’s reading'));
      if (e.limit) ui.add(li, ui.h('p', 'note', 'Where it does not fit: ' + e.limit));
    } else {
      ui.add(li, ui.h('span', null, e.sentence + ' '));
      if (e.source) ui.add(li, ui.link(e.url, e.source, e.nolink), ui.h('span', null, ' '));
      if (e.kind) ui.add(li, ui.h('span', 'lane', e.kind), ui.h('span', null, ' '));
      if (e.verified) ui.add(li, ui.badge(e.verified, e.url));
    }
    return li;
  }

  function list(ui, title, note, items) {
    if (!items.length) return null;
    var s = ui.section(title + ' (' + items.length + ')', note), ul = ui.h('ul', 'links');
    items.forEach(function (x) { ui.add(ul, x); });
    return ui.add(s, ul);
  }

  ns.ancientsPanel = function (ix, n, ui) {
    var root = ui.h('div'), L = ns.ancientLines(ix);
    ui.add(root, ui.h('p', 'kicker', ns.nodeWord(n)), ui.h('h2', null, name(n)));
    var lines = L.filter(function (l) { return l.from === n.id || l.to === n.id; });
    /* An ideal gathers what its whole family says and does; a pattern or a mechanism lists every
       link it has, so a name that carries no ideal (a funder, a lab) is not lost. */
    function recs(pred) {
      var out = [];
      if (n.type === 'ideal') {
        lines.forEach(function (l) { l.records.forEach(function (e) { if (pred(e)) out.push({ e: e, other: l.from === n.id ? l.to : l.from }); }); });
      } else {
        (ix.adj[n.id] || []).forEach(function (l) { if (pred(l.edge)) out.push({ e: l.edge, other: l.other }); });
        out.sort(function (a, b) { return byName(ix.byId[a.other], ix.byId[b.other]); });
      }
      return out.map(function (r) { return recordItem(ui, ix, r.e, r.other, ui.select); });
    }
    if (n.type === 'pattern') {
      if (n.summary) ui.add(root, ui.h('p', 'statement', n.summary));
      /* Sources and texts together, grouped by tradition, so no one tradition leads by default. */
      var all = (n.sources || []).map(function (s) { return { k: ns.traditionFamily(s.tradition), li: sourceItem(ui, s) }; })
        .concat((n.texts || []).map(function (t) { return ix.byId[t]; }).filter(Boolean).map(function (t) {
          var c = ui.h('p', 'cite');
          ui.add(c, ui.h('span', null, ns.textCite(t) + (t.url ? (/[.!?]$/.test(ns.textCite(t)) ? ' ' : '. ') : '')));
          if (t.url) ui.add(c, ui.link(t.url, 'source'), ui.h('span', null, ' '), ui.badge(t.verified, t.url));
          return { k: ns.traditionFamily(ns.tradition(t)), li: ui.add(ui.h('li', 'source'), ui.h('blockquote', null, '“' + t.quote + '”'), c) };
        }));
      all = ns.byTradition(all, function (o) { return o.k; });
      var fams = [];
      all.forEach(function (o) { if (fams.indexOf(o.k) < 0) fams.push(o.k); });
      if (fams.length) ui.add(root, ui.h('p', 'note', 'Traditions quoted here: ' + fams.join(', ') + '.'));
      ui.add(root,
        list(ui, 'Older sources', 'Each in a named translation, grouped by tradition.', all.map(function (o) { return o.li; })),
        list(ui, 'Invoked in their own words', 'Names on the map who use this name themselves.', recs(function (e) { return e.type === 'invokes'; })),
        list(ui, 'Read beside it', 'This project’s readings. Each says where the likeness stops.', recs(function (e) { return e.type === 'reads_as'; })));
      if ((n.counter || []).length) ui.add(root, list(ui, 'Where the tradition pushes back', null, n.counter.map(function (c) {
        return ui.add(ui.h('li', 'source'), ui.h('p', null, c.ref + ': ' + c.text));
      })));
    } else if (n.type === 'mechanism') {
      ui.add(root, ui.h('p', 'statement', n.definition));
      ui.add(root,
        list(ui, 'Named in scholarship', null, (n.scholarship || []).map(function (s) {
          var li = ui.h('li', 'source');
          ui.add(li, ui.h('span', null, s.author + ', '), ui.link(s.url, s.title, s.nolink), ui.h('span', null, ' (' + s.year + '). ' + (s.claim || '') + ' '));
          if (s.verified) ui.add(li, ui.badge(s.verified, s.url));
          return li;
        })),
        list(ui, 'Seen in', 'Documented, reported or alleged uses, each with its source.', recs(function (e) { return e.type === 'uses'; })),
        list(ui, 'Pushback on the record', 'Records against it, each with its source. They are not drawn as lines.', (n.pushback || []).map(function (b) {
          var li = ui.h('li', 'source');
          ui.add(li, ui.h('span', null, b.sentence + ' '), ui.link(b.url, b.source, b.nolink), ui.h('span', null, ' '), ui.badge(b.verified, b.url));
          return li;
        })),
        list(ui, 'Its ancient names', 'This project’s readings.', recs(function (e) { return e.type === 'reads_as'; })));
      if ((n.cautions || []).length) ui.add(root, list(ui, 'Cautions', null, n.cautions.map(function (c) { return ui.h('li', null, c); })));
    } else if (n.type === 'ideal') {
      ui.add(root, ui.h('p', 'statement', n.ideal));
      if ((n.field_key || []).length) {
        var fk = ui.section('The field key', 'This project’s five questions for anything that seems to speak or act (the wiki’s field key). A lens, not a finding.');
        var dl = ui.h('dl', 'fieldkey');
        n.field_key.forEach(function (x) { ui.add(dl, ui.h('dt', null, x.q), ui.h('dd', null, x.a)); });
        ui.add(root, ui.add(fk, dl));
      }
      var fam = family(ix, n.id), alleged = [];
      ix.g.edges.forEach(function (e) {
        if (e.type === 'uses' && e.kind === 'alleged' && fam[e.from]) alleged.push(recordItem(ui, ix, e, e.to, ui.select));
      });
      ui.add(root,
        list(ui, 'Invoked by its carriers', 'Words its carriers chose, filed here because they are about this ideal.', recs(function (e) { return e.type === 'invokes'; })),
        list(ui, 'Read beside', 'This project’s readings.', recs(function (e) { return e.type === 'reads_as'; })),
        list(ui, 'How it takes hold', null, recs(function (e) { return e.type === 'uses'; })),
        list(ui, 'Alleged uses', 'Listed with their sources and not drawn.', alleged));
      var open = ui.h('button', 'more-btn', 'Open it on the ideals map');
      open.type = 'button';
      open.addEventListener('click', function () { ui.go(n.id); });
      ui.add(root, open);
    } else {
      /* A name that is not drawn here (a carrier, a funder, a lab, a vehicle): its own words and uses, each with its source. */
      if (n.note) ui.add(root, ui.h('p', 'statement', n.note));
      ui.add(root,
        list(ui, 'In their own words', 'Where this name used an ancient name itself.', recs(function (e) { return e.type === 'invokes'; })),
        list(ui, 'How it takes hold', 'Documented, reported or alleged uses, each with its source.', recs(function (e) { return e.type === 'uses'; })),
        list(ui, 'Read beside', 'This project’s readings.', recs(function (e) { return e.type === 'reads_as'; })));
    }
    return root;
  };

  ns.ancientsEdgePanel = function (ix, l, ui) {
    var root = ui.h('div'), ul = ui.h('ul', 'links');
    ui.add(root, ui.h('p', 'kicker', l.type === 'invokes' ? 'In their own words' : l.type === 'uses' ? 'How it takes hold' : 'This project’s reading'),
      ui.h('h2', null, name(ix.byId[l.from]) + ' and ' + name(ix.byId[l.to])));
    l.records.forEach(function (e) { ui.add(ul, recordItem(ui, ix, e, null)); });
    ui.add(root, ul, ui.h('p', 'note', 'A text can motivate a question. It never confirms a mechanism or a source.'));
    return root;
  };

  /* How many quoted passages each tradition has on the map, largest first, said plainly. */
  function spread(ix, ui) {
    var count = {};
    (ix.g.texts || []).forEach(function (t) { var k = ns.traditionFamily(ns.tradition(t)); count[k] = (count[k] || 0) + 1; });
    (ix.g.patterns || []).forEach(function (p) { (p.sources || []).forEach(function (s) { var k = ns.traditionFamily(s.tradition); count[k] = (count[k] || 0) + 1; }); });
    var keys = Object.keys(count).sort(function (a, b) { return count[b] - count[a] || a.localeCompare(b); });
    if (!keys.length) return null;
    var box = ui.h('div', 'spread');
    ui.add(box, ui.h('p', 'note', 'Quoted from ' + keys.length + ' traditions: ' + keys.map(function (k) { return k + ' ' + count[k]; }).join(', ') +
      '. The project’s corpus began with the Bible, so it is still the largest share; passages from other traditions are being added, each from a named translation.'));
    return box;
  }

  ns.ancientsIntro = function (ix, ui) {
    var root = ui.h('div');
    ui.add(root, ui.h('p', 'kicker', 'How to read this'), ui.h('h2', null, 'What the ancients called it'),
      ui.h('p', null, 'On the left, what the movements serve. In the middle, how each takes hold of people. On the right, the patterns older traditions already named, from the ancient world to the modern philosophers: the image made to speak, calling up the dead, the tower, the merchant city, and others, each with its sources.'),
      ui.h('p', null, 'A solid line means a carrier of that ideal uses the ancient name itself, in its own words. A dotted line is this project’s reading: it says what the likeness is and where it stops. A dashed line is a documented or reported use of a mechanism, with its source; alleged uses are listed in the panels and not drawn.'),
      ui.h('p', 'note', 'The traditions are the subject here, quoted in their own words. A text can motivate a question. It never confirms a mechanism or a source, and nothing here says a text foretold anyone.'),
      spread(ix, ui),
      ui.h('p', 'note', ((ix.g.meta || {}).made_with) || ''));
    return root;
  };
})(window.IdealsMap = window.IdealsMap || {});
