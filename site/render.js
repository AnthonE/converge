/* Ideals Map: SVG drawing. All text enters the DOM through textContent. */
(function (ns) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var PHASE_WORD = { met: 'met', partly: 'partly met', not_met: 'not met', unknown: 'unknown' };
  var TYPE_WORD = { ideal: 'Ideal', carrier: 'Carrier', vehicle: 'Vehicle', fruit: 'Event', text: 'Text',
    funder: 'Funder', lab: 'AI company', evaluator: 'Evaluator', pattern: 'Ancient pattern', mechanism: 'How it takes hold', offshoot: 'Offshoot' };
  ns.typeWord = TYPE_WORD;
  /* A funder is named by what it is (a person, a foundation, a fund), not by the role alone. */
  ns.nodeWord = function (n) {
    return (n.type === 'funder' || n.type === 'carrier') && n.kind ? n.kind.charAt(0).toUpperCase() + n.kind.slice(1) : TYPE_WORD[n.type];
  };
  ns.phaseWord = PHASE_WORD;

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function label(parent, lines, x, y, cls, lineHeight, anchor) {
    var t = el('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'class': cls }, parent);
    lines.forEach(function (ln, i) {
      var s = el('tspan', { x: x, dy: i === 0 ? 0 : lineHeight }, t);
      s.textContent = ln;
    });
    return t;
  }

  /* Six small squares, one per phase: filled, half, hollow, or dashed (unknown). */
  function pips(parent, statuses, cx, y, phases) {
    var size = 9, gap = 4, total = 6 * size + 5 * gap, x0 = cx - total / 2;
    var words = statuses.map(function (s, i) { return (phases[i] ? phases[i].name : 'Phase ' + i) + ' ' + PHASE_WORD[s]; });
    var g = el('g', { 'class': 'pips', role: 'img', 'aria-label': 'Phases: ' + words.join(', ') }, parent);
    statuses.forEach(function (s, i) {
      var x = x0 + i * (size + gap);
      el('rect', { x: x, y: y, width: size, height: size, rx: 2, 'class': 'pip pip-' + s }, g);
      if (s === 'partly') el('rect', { x: x, y: y, width: size / 2, height: size, rx: 1, 'class': 'pip-half' }, g);
    });
    return g;
  }

  /* A single phase square as a small standalone svg, for the panel. */
  ns.pipIcon = function (status) {
    var s = el('svg', { width: 12, height: 12, viewBox: '0 0 12 12', 'class': 'pipicon', 'aria-hidden': 'true' });
    el('rect', { x: 1.5, y: 1.5, width: 9, height: 9, rx: 2, 'class': 'pip pip-' + status }, s);
    if (status === 'partly') el('rect', { x: 1.5, y: 1.5, width: 4.5, height: 9, rx: 1, 'class': 'pip-half' }, s);
    return s;
  };

  function shape(g, item, selected) {
    var n = item.node, r;
    if (n.type === 'ideal') {
      r = item.role === 'centre' ? 46 : item.role === 'rim' || item.side ? 14 : 32;
      el('circle', { r: r + 2, 'class': 'ring' }, g);
      el('circle', { r: r, 'class': 'mark mark-ideal' }, g);
    } else if (n.type === 'carrier') {
      r = 17;
      el('circle', { r: r + 2, 'class': 'ring' }, g);
      el('circle', { r: r, 'class': 'mark mark-carrier' }, g);
    } else if (n.type === 'vehicle') {
      r = 16;
      el('rect', { x: -r - 2, y: -r - 2, width: 2 * r + 4, height: 2 * r + 4, rx: 6, 'class': 'ring' }, g);
      el('rect', { x: -r, y: -r, width: 2 * r, height: 2 * r, rx: 4, 'class': 'mark mark-vehicle' }, g);
    } else if (n.type === 'pattern') {
      r = 15;
      el('path', { d: 'M0,-18 L18,0 L0,18 L-18,0 Z', 'class': 'ring' }, g);
      el('path', { d: 'M0,-15 L15,0 L0,15 L-15,0 Z', 'class': 'mark mark-pattern' }, g);
      el('circle', { r: 4.5, 'class': 'mark-pattern-core' }, g);
    } else if (n.type === 'mechanism') {
      r = 14;
      el('rect', { x: -17, y: -12, width: 34, height: 24, rx: 12, 'class': 'ring' }, g);
      el('rect', { x: -15, y: -10, width: 30, height: 20, rx: 10, 'class': 'mark mark-mechanism' }, g);
    } else if (n.type === 'offshoot') {
      r = 16;
      el('circle', { r: r + 2, 'class': 'ring' }, g);
      el('circle', { r: r, 'class': 'mark mark-offshoot' }, g);
      el('path', { d: 'M-7,-7 L7,7 M7,-7 L-7,7', 'class': 'mark-offshoot-cross' }, g);
    } else if (n.type === 'funder') {
      r = 15;
      el('path', { d: 'M0,-19 L18.5,13 L-18.5,13 Z', 'class': 'ring' }, g);
      el('path', { d: 'M0,-15 L15,11 L-15,11 Z', 'class': 'mark mark-funder' }, g);
    } else if (n.type === 'evaluator') {
      r = 15;
      el('path', { d: hexagon(17.5), 'class': 'ring' }, g);
      el('path', { d: hexagon(15), 'class': 'mark mark-evaluator' }, g);
    } else if (n.type === 'lab') {
      r = 14;
      el('rect', { x: -r - 2, y: -r - 2, width: 2 * r + 4, height: 2 * r + 4, 'class': 'ring' }, g);
      el('rect', { x: -r, y: -r, width: 2 * r, height: 2 * r, 'class': 'mark mark-lab' }, g);
      el('rect', { x: -5, y: -5, width: 10, height: 10, 'class': 'mark-lab-core' }, g);
    } else if (n.type === 'fruit') {
      r = 12;
      el('rect', { x: -r - 2, y: -r - 2, width: 2 * r + 4, height: 2 * r + 4, rx: 3, transform: 'rotate(45)', 'class': 'ring' }, g);
      el('rect', { x: -r, y: -r, width: 2 * r, height: 2 * r, rx: 2, transform: 'rotate(45)', 'class': 'mark mark-fruit' }, g);
      r = 17;
    } else {
      el('rect', { x: -76, y: -19, width: 152, height: 38, rx: 9, 'class': 'mark mark-text' }, g);
      r = 19;
    }
    if (selected) g.setAttribute('class', g.getAttribute('class') + ' is-selected');
    /* Hit area larger than the mark. */
    var hit = Math.max(r + 8, 14);
    if (n.type === 'text') el('rect', { x: -82, y: -24, width: 164, height: 48, 'class': 'hit' }, g);
    else el('circle', { r: hit, 'class': 'hit' }, g);
    return r;
  }

  function hexagon(r) {
    var pts = [];
    for (var i = 0; i < 6; i++) pts.push((r * Math.cos(Math.PI / 3 * i)).toFixed(1) + ',' + (r * Math.sin(Math.PI / 3 * i)).toFixed(1));
    return 'M' + pts.join(' L') + ' Z';
  }

  function nodeLabel(g, item, r, ix) {
    var n = item.node, w = ns.wrap;
    /* The money view sets its labels beside the mark, on one line. */
    if (item.side) {
      var left = item.side === 'left';
      label(g, w(n.label || n.ref, item.role !== 'ancient' ? 34 : n.type === 'pattern' ? 36 : 40, 1), left ? -r - 11 : r + 11, 5, 'lbl lbl-small', 17, left ? 'end' : 'start');
      return;
    }
    if (item.role === 'money-centre') { label(g, w(n.label || n.ref, 26, 2), 0, r + 26, 'lbl lbl-ideal', 20); return; }
    if (n.type === 'ideal') {
      if (item.role === 'rim') { label(g, w(n.label, 16, 3), 0, r + 19, 'lbl lbl-small', 17); return; }
      var big = item.role === 'centre';
      label(g, w(n.label, big ? 30 : 20, big ? 2 : 3), 0, r + (big ? 27 : 23), big ? 'lbl lbl-centre' : 'lbl lbl-ideal', big ? 23 : 19);
      pips(g, ns.phaseSummary(n), 0, -r - 20, ix.g.phases || []);
      if (!big) {
        var c = { carrier: 0, fruit: 0, offshoot: 0 };
        Object.keys(ns.members(ix, n.id)).forEach(function (m) { var t = ix.byId[m].type; if (t in c) c[t]++; });
        var lines = w(n.label, 20, 3).length;
        label(g, [c.carrier + (c.carrier === 1 ? ' carrier' : ' carriers') + ' · ' + c.fruit + (c.fruit === 1 ? ' event' : ' events')],
          0, r + 23 + lines * 19 + 1, 'lbl lbl-muted', 16);
        /* Offshoots come forward: a line of their own under the counts. */
        if (c.offshoot) label(g, ['\u2715 ' + c.offshoot + (c.offshoot === 1 ? ' offshoot' : ' offshoots')], 0, r + 23 + lines * 19 + 18, 'lbl lbl-offshoot', 16);
      }
    } else if (n.type === 'text') {
      label(g, [n.ref], 0, 5, 'lbl lbl-text', 16);
    } else if (n.type === 'fruit') {
      label(g, [n.date], 0, -r - 9, 'lbl lbl-muted', 16);
      label(g, w(n.label, 15, 3), 0, r + 19, 'lbl lbl-small', 17);
    } else {
      label(g, w(n.label, 20, 2), 0, r + 20, 'lbl lbl-small', 17);
    }
  }

  function edgePath(e) {
    if (e.d) return e.d;
    if (e.bend) {
      /* Curve ideal-to-ideal links toward the middle so they do not hug the ring. */
      var mx = (e.a.x + e.b.x) / 2, my = (e.a.y + e.b.y) / 2;
      var qx = mx + (e.bend.x - mx) * 0.55, qy = my + (e.bend.y - my) * 0.55;
      return 'M' + e.a.x + ',' + e.a.y + ' Q' + qx + ',' + qy + ' ' + e.b.x + ',' + e.b.y;
    }
    return 'M' + e.a.x + ',' + e.a.y + ' L' + e.b.x + ',' + e.b.y;
  }

  /* Draw one layout into the svg. handlers: {node(n), edge(e), tip(text, evt), untip()} */
  ns.draw = function (svg, layout, ix, state, handlers) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', '0 0 ' + ns.size.w + ' ' + (layout.h || ns.size.h));
    var edgeLayer = el('g', { 'class': 'edges' }, svg);
    var nodeLayer = el('g', { 'class': 'nodes' }, svg);

    (layout.captions || []).forEach(function (c) {
      el('text', { x: c.x, y: c.y, 'class': 'cap', 'text-anchor': c.anchor }, edgeLayer).textContent = c.text;
    });

    /* In the focus view only the centre's own links are drawn at full weight. Links
       between its neighbours are faint, and links to events stay hidden until one end
       is hovered, focused or selected. */
    var touching = {};
    function near(id, on) {
      (touching[id] || []).forEach(function (p) { p.classList.toggle('is-near', on || p.getAttribute('data-keep') === '1'); });
    }
    layout.edges.forEach(function (e) {
      var d = edgePath(e), t = e.edge.type, c = layout.centre;
      var local = c && e.edge.from !== c && e.edge.to !== c;
      var toFruit = ix.byId[e.edge.from].type === 'fruit' || ix.byId[e.edge.to].type === 'fruit';
      var keep = state.selected && (e.edge.from === state.selected || e.edge.to === state.selected);
      var cls = 'edge edge-' + t + (e.edge.lens ? ' edge-lens' : '') + (state.edge === e.edge.i ? ' is-selected' : '') +
        (c && toFruit ? ' edge-quiet' : local || layout.quiet ? ' edge-faint' : '') + (keep ? ' is-near' : '');
      var path = el('path', { d: d, 'class': cls, 'data-keep': keep ? '1' : '0' }, edgeLayer);
      if (typeof e.edge.i === 'string') path.setAttribute('data-i', e.edge.i);
      [e.edge.from, e.edge.to].forEach(function (id) { (touching[id] = touching[id] || []).push(path); });
      var hit = el('path', { d: d, 'class': 'edge-hit' }, edgeLayer);
      hit.addEventListener('pointermove', function (ev) { handlers.tip(e.tip || e.edge.sentence || t, ev); });
      hit.addEventListener('pointerleave', handlers.untip);
      hit.addEventListener('click', function () { handlers.edge(e.edge); });
    });

    layout.nodes.forEach(function (item) {
      var n = item.node;
      var g = el('g', {
        'class': 'node node-' + n.type + ' role-' + item.role,
        transform: 'translate(' + item.x + ',' + item.y + ')',
        tabindex: 0, role: 'button',
        'aria-label': ns.nodeWord(n) + ': ' + (n.label || n.ref) +
          (layout.centre && item.side ? (item.side === 'left' ? ', on the side that pays, hosts or evaluates it' : ', on the side it pays, hosts or evaluates') : ''),
        'data-id': n.id
      }, nodeLayer);
      var r = shape(g, item, state.selected === n.id);
      nodeLabel(g, item, r, ix);
      var tipText = ns.nodeWord(n) + ': ' + (n.type === 'text' ? n.ref + ' — ' + n.quote : n.label);
      g.addEventListener('pointerenter', function () { near(n.id, true); });
      g.addEventListener('pointermove', function (ev) { handlers.tip(tipText, ev); });
      g.addEventListener('pointerleave', function () { near(n.id, false); handlers.untip(); });
      g.addEventListener('focus', function () { near(n.id, true); handlers.tip(tipText, null, g); });
      g.addEventListener('blur', function () { near(n.id, false); handlers.untip(); });
      g.addEventListener('click', function () { handlers.node(n); });
      g.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); handlers.node(n); }
      });
    });
  };
})(window.IdealsMap = window.IdealsMap || {});
