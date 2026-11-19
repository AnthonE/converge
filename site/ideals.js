/* The ideals as cards: the opening view. Each card gives the ideal's name, one voice from its record with the speaker
   and the source, who carries it and who answers it, and where it stands, phase by phase, in words.
   All text enters the DOM through textContent. */
(function (ns) {
  'use strict';

  var STAND = { met: 'met', partly: 'partly met', not_met: 'not met', unknown: 'unknown' };

  function names(ix, ids, max) {
    var list = ids.map(function (id) { return ix.byId[id]; }).filter(Boolean);
    return { shown: list.slice(0, max), more: Math.max(0, list.length - max) };
  }

  /* Who carries an ideal, and who answers or opposes it: carriers only, by the link's own type. */
  function sides(ix, d) {
    var carry = [], answer = [];
    (ix.adj[d.id] || []).forEach(function (l) {
      var o = ix.byId[l.other];
      if (!o || o.type !== 'carrier' || l.edge.to !== d.id) return;
      if (l.edge.type === 'carries' && carry.indexOf(o.id) < 0) carry.push(o.id);
      if (l.edge.type === 'opposes' && answer.indexOf(o.id) < 0) answer.push(o.id);
    });
    return { carry: carry, answer: answer };
  }

  function nameRow(ui, nav, ix, label, ids) {
    if (!ids.length) return null;
    var n = names(ix, ids, 4), p = ui.h('p', 'card-names');
    ui.add(p, ui.h('span', 'card-k', label + ' '));
    /* The comma stays with the name before it, so a line never starts with one. */
    n.shown.forEach(function (c, i) {
      var b = ui.h('button', 'linkbtn', c.label); b.type = 'button';
      b.addEventListener('click', function () { nav.goRecord(c.id); });
      ui.add(p, ui.add(ui.h('span', 'card-nm'), b, i < n.shown.length - 1 ? ui.h('span', null, ',') : null), ui.h('span', null, ' '));
    });
    if (n.more) ui.add(p, ui.h('span', 'card-more', ' and ' + n.more + ' more'));
    return p;
  }

  /* The six phases, each named, with its mark; the title says what the phase means. */
  function standing(ui, ix, d) {
    var sum = ns.phaseSummary(d), ul = ui.h('ul', 'card-phases');
    ul.setAttribute('aria-label', 'Where it stands, phase by phase');
    (ix.g.phases || []).forEach(function (p, i) {
      var li = ui.h('li', 'cp cp-' + sum[i]);
      li.title = p.what + ' (' + STAND[sum[i]] + ')';
      ui.add(li, ns.pipIcon(sum[i]), ui.h('span', 'sr', p.what + ': ' + STAND[sum[i]]));
      ui.add(ul, li);
    });
    return ul;
  }

  /* Where an ideal stands, in one plain sentence: what has happened so far, partly, and not yet. */
  ns.standSentence = function (ix, d) {
    var sum = ns.phaseSummary(d), g = { met: [], partly: [], not_met: [], unknown: [] };
    (ix.g.phases || []).forEach(function (p, i) { g[sum[i]].push(p.plain || p.what); });
    return [['met', 'So far: '], ['partly', 'Partly: '], ['not_met', 'Not yet: '], ['unknown', 'Not known: ']]
      .filter(function (k) { return g[k[0]].length; })
      .map(function (k) { var t = g[k[0]].join('; '); return k[1] + t + '.'; }).join(' ');
  };

  /* Start with a name you know: people and companies most readers have heard of (meta.front_names). */
  function frontNames(ix, ui, nav) {
    var people = {};
    (ix.g.people || []).forEach(function (p) { people[p.id] = p; });
    var ids = ((ix.g.meta || {}).front_names || []).filter(function (id) { return ix.byId[id] || people[id]; });
    if (!ids.length) return null;
    var box = ui.h('nav', 'front-names');
    box.setAttribute('aria-label', 'Start with a name you know');
    ui.add(box, ui.h('p', 'front-names-k', 'Start with a name you know'));
    var row = ui.h('div', 'name-row');
    ids.forEach(function (id) {
      var b = ui.h('button', 'name-chip', people[id] ? people[id].name : ix.byId[id].label); b.type = 'button';
      b.setAttribute('data-name', id);
      b.addEventListener('click', function () { nav.goRecord(id); });
      ui.add(row, b);
    });
    return ui.add(box, row);
  }

  function card(ui, nav, ix, d) {
    var art = ui.h('article', 'card');
    art.setAttribute('data-ideal', d.id);
    var title = ui.h('button', 'card-title', d.label); title.type = 'button';
    title.addEventListener('click', function () { nav.go(d.id); });
    ui.add(art, ui.add(ui.h('h3', 'card-h'), title));
    /* One voice from the record: the one the data marks as its lead, else the first. Always with its speaker. */
    var words = d.words || [], w = words[typeof d.lead === 'number' && words[d.lead] ? d.lead : 0];
    if (w) {
      var fig = ui.h('figure', 'card-quote');
      ui.add(fig, ui.h('blockquote', null, '“' + w.quote + '”'));
      var cap = ui.h('figcaption', 'cite');
      ui.add(cap, ui.h('span', null, w.speaker + ', '), ui.link(w.url, w.source, w.nolink), ui.h('span', null, ' '), ui.badge(w.verified, w.url));
      ui.add(art, ui.add(fig, cap));
    }
    var s = sides(ix, d);
    ui.add(art, nameRow(ui, nav, ix, 'Held by', s.carry), nameRow(ui, nav, ix, 'Answered or opposed by', s.answer));
    ui.add(art, ui.add(ui.h('div', 'card-stand'), ui.h('span', 'card-k', 'Where it stands'), standing(ui, ix, d),
      ui.h('p', 'stand-text', ns.standSentence(ix, d))));
    /* Counts as on the drawing, and the newest dated event. */
    var mem = ns.members(ix, d.id), c = { carrier: 0, fruit: 0 }, newest = '';
    Object.keys(mem).forEach(function (m) {
      var t = ix.byId[m].type;
      if (t in c) c[t]++;
      if (t === 'fruit' && String(ix.byId[m].date || '') > newest) newest = String(ix.byId[m].date);
    });
    var foot = ui.h('p', 'card-foot');
    ui.add(foot, ui.h('span', null, 'held by ' + c.carrier + ' · ' + c.fruit + (c.fruit === 1 ? ' event' : ' events') +
      (newest ? ' · newest ' + newest : '') + ' '));
    var open = ui.h('button', 'linkbtn card-open', 'Open it →'); open.type = 'button';
    open.addEventListener('click', function () { nav.go(d.id); });
    ui.add(art, ui.add(foot, open));
    return art;
  }

  /* The newest on the record: the latest claims on the Watch and dated events, so a returning reader sees what moved.
     Search engines are asked to take no snippet from it: claims wait for a person's re-read before they are indexed. */
  function newest(ix, ui, nav) {
    var items = [];
    (ix.g.watch || []).forEach(function (w) { if (w.date) items.push({ date: String(w.date), w: w }); });
    (ix.g.fruits || []).forEach(function (f) { if (f.date) items.push({ date: String(f.date), f: f }); });
    if (!items.length) return null;
    items.sort(function (a, b) { return b.date.localeCompare(a.date); });
    var s = ui.section('Newest on the record', 'The latest claims on the Watch and dated events. A claim on the Watch is not a finding.');
    s.classList.add('newest');
    s.setAttribute('data-nosnippet', '');
    var ul = ui.h('ul', 'links rec-list');
    items.slice(0, 4).forEach(function (it) {
      var li = ui.h('li'), x = it.w || it.f;
      var b = ui.h('button', 'linkbtn', it.w ? it.w.title : (x.label || x.what)); b.type = 'button';
      b.addEventListener('click', function () { if (it.w) nav.goWatch(x.id); else nav.goRecord(x.id); });
      /* One quiet line of when and how it stands, then the title. */
      var mark = it.w ? (ns.rereadMark ? ns.rereadMark(ui, ix, x) : null) : ui.badge(x.verified, x.url);
      var meta = [it.date].concat(it.w ? ['claim on the Watch', (ns.watchStatus || {})[x.status] || x.status] : [x.kind]);
      if (mark) meta.push(mark.textContent);
      ui.add(li, ui.h('span', 'newest-meta', meta.join(' · ')), b);
      ui.add(ul, li);
    });
    var more = ui.h('button', 'linkbtn', 'The whole timeline →'); more.type = 'button';
    more.addEventListener('click', function () { nav.goView('timeline'); });
    return ui.add(s, ul, ui.add(ui.h('p'), more));
  }

  ns.renderCards = function (box, ix, ui, nav) {
    while (box.firstChild) box.removeChild(box.firstChild);
    var m = ix.g.meta || {}, ideals = ix.g.ideals || [];
    ui.add(box, frontNames(ix, ui, nav));
    var intro = ui.h('div', 'watch-intro');
    ui.add(intro, ui.h('h2', null, ideals.length + ' stated aims for AI'),
      ui.h('p', null, 'Each card is one ideal: an end that a movement, company or community says AI serves, with one voice from its record, named. Open a card for who holds it, what has happened, who pays, and the other side.'),
      ui.h('p', 'note', 'The ideals’ names are this map’s short labels. Where it stands turns on things you could observe; nothing here is a forecast.'));
    ui.add(box, intro);
    var grid = ui.h('div', 'cards');
    ideals.forEach(function (d) { ui.add(grid, card(ui, nav, ix, d)); });
    ui.add(box, grid);
    /* Below the cards, so a phone still opens on them; "What's new" in the header jumps here. */
    var nw = newest(ix, ui, nav);
    if (nw) { nw.id = 'newest'; nw.tabIndex = -1; ui.add(box, nw); }

    var off = (ix.g.offshoots || []).slice().sort(function (a, b) { return a.label.localeCompare(b.label); });
    if (off.length) {
      var s = ui.section('Offshoots (' + off.length + ')', 'Groups that came out of a community on this map and state no program the map records as an ideal. Each is shown with its public record and every matter’s status. Coming out of a community is not being caused by it.');
      var ul = ui.h('ul', 'links');
      off.forEach(function (o) {
        var b = ui.h('button', 'linkbtn', o.label); b.type = 'button';
        b.setAttribute('data-offshoot', o.id);
        b.addEventListener('click', function () { nav.goRecord(o.id); });
        ui.add(ul, ui.add(ui.h('li'), b, ui.h('span', null, ' ' + (o.status || ''))));
      });
      ui.add(box, ui.add(s, ul));
    }
    var notes = [m.note, m.made_with].filter(Boolean);
    notes.forEach(function (t) { ui.add(box, ui.h('p', 'note cards-note', t)); });
  };
})(window.IdealsMap = window.IdealsMap || {});
