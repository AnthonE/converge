/* Ideals Map: graph index and deterministic layout. No dependencies, no randomness.
   Exposes window.IdealsMap.{index, overview, focus, phaseSummary, wrap}. */
(function (ns) {
  'use strict';

  var TYPES = ['ideals', 'carriers', 'vehicles', 'fruits', 'texts', 'funders', 'labs', 'evaluators', 'patterns', 'mechanisms', 'offshoots'];
  ns.types = TYPES;
  var W = 1400, H = 820;
  ns.size = { w: W, h: H };

  /* Build lookup tables once. Every node gets a .type (singular). */
  ns.index = function (g) {
    var byId = {}, adj = {};
    TYPES.forEach(function (t) {
      (g[t] || []).forEach(function (n) {
        n.type = t.slice(0, -1);
        byId[n.id] = n;
        adj[n.id] = [];
      });
    });
    (g.edges || []).forEach(function (e, i) {
      e.i = i;
      if (byId[e.from] && byId[e.to]) {
        adj[e.from].push({ edge: e, other: e.to });
        adj[e.to].push({ edge: e, other: e.from });
      }
    });
    return { g: g, byId: byId, adj: adj };
  };

  /* An older text's tradition, and the broad family a pattern source's tradition belongs to, so texts from
     many traditions can be sorted and counted together. A text with no tradition is from the King James Bible. */
  ns.tradition = function (t) { return (t && t.tradition) || 'Hebrew Bible'; };
  ns.traditionFamily = function (s) {
    s = String(s || '');
    if (/^Hebrew Bible|^New Testament/.test(s)) return s.replace(/ \(.*$/, '');
    if (/Hermetic/.test(s)) return 'Hermetic';
    if (/Hellenistic Jewish|Rabbinic|Jewish/.test(s)) return 'Jewish, beyond the Hebrew Bible';
    if (/Greek|Roman/.test(s)) return 'Greek and Roman';
    if (/Mesopotamian/.test(s)) return 'Mesopotamian';
    if (/Egyptian/.test(s)) return 'Egyptian';
    return s.replace(/ \(.*$/, '');
  };
  /* "Tradition · translation", for the line under a quoted text. */
  ns.textCite = function (t) {
    return [t.ref, ns.tradition(t), t.translation || 'King James Version'].join(' · ');
  };
  /* Texts in a steady order: by tradition, then as the data lists them. No tradition goes first by default. */
  ns.byTradition = function (list, get) {
    get = get || ns.tradition;
    return list.map(function (x, i) { return { x: x, i: i, k: ns.traditionFamily(get(x)) }; })
      .sort(function (a, b) { return a.k.localeCompare(b.k) || a.i - b.i; }).map(function (o) { return o.x; });
  };

  /* One status per phase 0..5 for an ideal: met | partly | not_met | unknown. */
  ns.phaseSummary = function (ideal) {
    var out = [];
    for (var p = 0; p <= 5; p++) {
      var entry = (ideal.phases || []).filter(function (x) { return x.phase === p; })[0];
      /* Context conditions (a reversal check, the opposition's institutions) are shown but not counted. */
      var conds = (entry ? entry.conditions || [] : []).filter(function (c) { return !c.context; });
      if (!conds.length) { out.push('unknown'); continue; }
      var met = conds.filter(function (c) { return c.status === 'met'; }).length;
      var some = conds.filter(function (c) { return c.status === 'met' || c.status === 'partly'; }).length;
      var known = conds.filter(function (c) { return c.status !== 'unknown'; }).length;
      out.push(!known ? 'unknown' : met === conds.length ? 'met' : some ? 'partly' : 'not_met');
    }
    return out;
  };

  /* Greedy word wrap by character count. Returns at most maxLines lines. */
  ns.wrap = function (text, width, maxLines) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      if (cur && (cur + ' ' + w).length > width) { lines.push(cur); cur = w; }
      else { cur = cur ? cur + ' ' + w : w; }
    });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines[maxLines - 1];
      lines[maxLines - 1] = (last.length < width ? last : last.replace(/\s*\S+$/, '')) + '…';
    }
    return lines;
  };

  function spread(n, lo, hi) {
    if (n === 1) return [(lo + hi) / 2];
    var out = [];
    for (var i = 0; i < n; i++) out.push(lo + (hi - lo) * i / (n - 1));
    return out;
  }

  /* Overview: every ideal on one ellipse, in data order, with ideal-to-ideal links. */
  ns.overview = function (ix) {
    var ideals = ix.g.ideals, n = ideals.length, pos = {}, nodes = [], edges = [];
    var cx = W / 2, cy = H / 2 - 12, rx = 560, ry = 292;
    /* Equal spacing along the ellipse, not equal angles, so the sides do not crowd. */
    var steps = 720, cum = [0], pts = [];
    for (var k = 0; k <= steps; k++) {
      var t = -Math.PI / 2 + 2 * Math.PI * k / steps;
      pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
      if (k) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    }
    var total = cum[steps], j = 0;
    ideals.forEach(function (d, i) {
      var want = total * i / n;
      while (j < steps && cum[j + 1] < want) j++;
      pos[d.id] = { x: pts[j][0], y: pts[j][1] };
      nodes.push({ node: d, x: pos[d.id].x, y: pos[d.id].y, role: 'ideal' });
    });
    ix.g.edges.forEach(function (e) {
      if (pos[e.from] && pos[e.to]) {
        edges.push({ edge: e, a: pos[e.from], b: pos[e.to], bend: { x: cx, y: cy } });
      }
    });
    return { nodes: nodes, edges: edges };
  };

  /* Members of an ideal's neighbourhood: the ideal, everything one link away, and the
     vehicles and fruits that hang off its carriers and vehicles. */
  ns.members = function (ix, id) {
    var seen = {}; seen[id] = true;
    ix.adj[id].forEach(function (l) { seen[l.other] = true; });
    /* A name tied to this ideal only by a reading stands beside it, but its own events and
       vehicles are not this ideal's: no record ties them to it. */
    var byReading = {};
    ix.adj[id].forEach(function (l) { if (byReading[l.other] !== false) byReading[l.other] = l.edge.lens === true; });
    Object.keys(seen).forEach(function (m) {
      var t = ix.byId[m].type;
      if (m === id || byReading[m] === true || (t !== 'carrier' && t !== 'vehicle')) return;
      ix.adj[m].forEach(function (l) {
        var ot = ix.byId[l.other].type;
        /* A historical carrier's own events stay in its panel: no record ties them to today's carriers of the ideal. */
        if (ot === 'fruit' && ix.byId[m].historical) return;
        if (ot === 'vehicle' || ot === 'fruit' || ot === 'ideal') seen[l.other] = true;
        /* An offshoot that came out of one of this ideal's carriers comes forward in its view. One that came
           out of a forum or a product (a vehicle) is listed on the overview instead: a vehicle is shared, and
           drawing the group under an ideal it runs would tie them with no record behind it. */
        if (ot === 'offshoot' && l.edge.type === 'breaks_from' && t === 'carrier') seen[l.other] = true;
        /* A vehicle reached through a carrier brings its own events with it. */
        if (t === 'carrier' && ot === 'vehicle') ix.adj[l.other].forEach(function (k) {
          if (ix.byId[k.other].type === 'fruit') seen[k.other] = true;
        });
      });
    });
    return seen;
  };

  var CARRIER_SLOTS = [[470, 235], [930, 235], [470, 400], [930, 400], [285, 318], [1115, 318],
    [285, 178], [1115, 178], [285, 458], [1115, 458]];

  /* Focus: one ideal in the centre; carriers beside, vehicles below,
     fruits along the bottom in date order, other ideals on the left and right rims. */
  ns.focus = function (ix, id) {
    var seen = ns.members(ix, id), pos = {}, nodes = [], edges = [], dropped = 0;
    function byType(t) {
      return Object.keys(seen).filter(function (m) { return m !== id && ix.byId[m].type === t; })
        .map(function (m) { return ix.byId[m]; });
    }
    function put(n, x, y, role) { pos[n.id] = { x: x, y: y }; nodes.push({ node: n, x: x, y: y, role: role }); }

    put(ix.byId[id], W / 2, 310, 'centre');
    /* Older texts are not drawn here. The drawing shows who carries the ideal and what has happened; the texts
       this project reads beside it are listed lower in the panel and in the ancients view, each with its tradition. */

    /* A funder, company or evaluator linked to this ideal directly stands with its carriers. */
    var carriers = byType('carrier').concat(byType('funder'), byType('lab'), byType('evaluator'));
    dropped += Math.max(0, carriers.length - CARRIER_SLOTS.length);
    carriers.slice(0, CARRIER_SLOTS.length).forEach(function (c, i) {
      put(c, CARRIER_SLOTS[i][0], CARRIER_SLOTS[i][1], 'carrier');
    });

    /* Order vehicles by the mean x of the carriers they hang off, so their links run
       roughly straight down instead of crossing. */
    function meanX(n) {
      var xs = ix.adj[n.id].map(function (l) { return pos[l.other]; }).filter(Boolean).map(function (p) { return p.x; });
      return xs.length ? xs.reduce(function (a, b) { return a + b; }, 0) / xs.length : W / 2;
    }
    var vehicles = byType('vehicle').sort(function (a, b) { return meanX(a) - meanX(b) || a.id.localeCompare(b.id); });
    dropped += Math.max(0, vehicles.length - 6);
    vehicles = vehicles.slice(0, 6);
    /* Offshoots take the outer ends of this row, so vehicles keep to the middle when there are any. */
    var hasOff = byType('offshoot').length > 0;
    var vw = Math.min(hasOff ? 660 : 900, 180 * Math.max(1, vehicles.length - 1));
    spread(vehicles.length, W / 2 - vw / 2, W / 2 + vw / 2)
      .forEach(function (x, i) { put(vehicles[i], x, 560, 'vehicle'); });

    /* Events of the ideal's own carriers and vehicles come first. Events that hang only on an
       opposing voice, or on a name linked by a reading, fill whatever room is left. */
    var core = {}; core[id] = true;
    ix.adj[id].forEach(function (l) { if (!l.edge.lens && l.edge.type !== 'opposes') core[l.other] = true; });
    Object.keys(core).forEach(function (m) {
      if (ix.byId[m].type === 'carrier') ix.adj[m].forEach(function (l) { if (ix.byId[l.other].type === 'vehicle') core[l.other] = true; });
    });
    function own(f) { return ix.adj[f.id].some(function (l) { return core[l.other]; }); }
    function byDate(a, b) { return String(a.date).localeCompare(String(b.date)); }
    /* An alleged event is listed in its name's panel and never takes a place in the row. */
    var all = byType('fruit').filter(function (f) { return f.kind !== 'alleged'; }).sort(byDate);
    var mine = all.filter(own), rest = all.filter(function (f) { return !own(f); });
    var fruits = mine.slice(-8);
    fruits = fruits.concat(rest.slice(rest.length - Math.min(rest.length, 8 - fruits.length))).sort(byDate);
    dropped += all.length - fruits.length;
    spread(fruits.length, fruits.length > 4 ? 230 : 420, fruits.length > 4 ? 1170 : 980)
      .forEach(function (x, i) { put(fruits[i], x, 705, 'fruit'); });

    /* Offshoots stand at the outer ends of the lower rows, apart from what the ideal runs on. */
    var off = byType('offshoot');
    var OFF_SLOTS = [[105, 560], [W - 105, 560], [105, 640], [W - 105, 640]];
    dropped += Math.max(0, off.length - OFF_SLOTS.length);
    off.slice(0, OFF_SLOTS.length).forEach(function (o, i) { put(o, OFF_SLOTS[i][0], OFF_SLOTS[i][1], 'offshoot'); });

    var others = byType('ideal');
    dropped += Math.max(0, others.length - 8);
    others.slice(0, 8).forEach(function (o, i) {
      var left = i % 2 === 0, k = Math.floor(i / 2);
      put(o, left ? 80 : W - 80, 185 + k * 98, 'rim');
    });

    /* Links between two rim ideals belong to the overview, not to this ideal. */
    var rim = {};
    nodes.forEach(function (n) { if (n.role === 'rim') rim[n.node.id] = true; });
    ix.g.edges.forEach(function (e) {
      /* An alleged money record stays in its names' money panels. It is not drawn as a line here either (spec section 8, guardrail 4). */
      if ((e.type === 'funds' || e.type === 'evaluates' || e.type === 'hosts') && e.kind === 'alleged') return;
      /* So is an alleged event: it stays in the panel of the name it hangs on. */
      if (e.type === 'bears_fruit' && ix.byId[e.to] && ix.byId[e.to].kind === 'alleged') return;
      if (pos[e.from] && pos[e.to] && !(rim[e.from] && rim[e.to])) edges.push({ edge: e, a: pos[e.from], b: pos[e.to] });
    });
    /* A node whose only way in was a carrier that did not fit would be drawn with no link. */
    var tied = {}, before = nodes.length;
    edges.forEach(function (e) { tied[e.edge.from] = tied[e.edge.to] = true; });
    nodes = nodes.filter(function (n) { return n.role === 'centre' || tied[n.node.id] === true; });
    dropped += before - nodes.length;
    var captions = [];
    if (carriers.length) captions.push({ text: 'Carried or opposed by', x: 235, y: 132 });
    if (others.length) captions.push({ text: 'Linked ideals', x: 22, y: 150 });
    if (vehicles.length) captions.push(off.length ? { text: 'Runs on', x: W / 2 - vw / 2 - 30, y: 515 } : { text: 'Runs on', x: 40, y: 600 });
    if (fruits.length) captions.push({ text: 'What happened', x: 40, y: 700 });
    if (off.length) captions.push({ text: 'Came out of it', x: 22, y: 520 });
    return { nodes: nodes, edges: edges, dropped: dropped, centre: id, captions: captions };
  };
})(window.IdealsMap = window.IdealsMap || {});
