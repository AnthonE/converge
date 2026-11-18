/* The way in for a newcomer: a plain-words guide, a timeline of everything dated, and a search box.
   All text enters the DOM through textContent. */
(function (ns) {
  'use strict';

  var GLOSSARY = [
    ['Ideal', 'An end a movement says it serves, such as “a made mind will save us” or “escape death”. The names of the ideals are this map’s own short labels; each ideal’s page quotes the people who hold it.'],
    ['Carrier', 'A movement, organisation, community, product or public figure that states or works for an ideal.'],
    ['Vehicle', 'The made thing an ideal runs on: a model, an app, a forum, a token, a newsletter.'],
    ['Event', 'Something that happened, with a date and a source. Each is marked documented (a record shows it), reported (the press says so) or alleged (someone accuses; nothing is decided).'],
    ['Phase', 'Six steps an ideal can pass through, from written down to hard to refuse. Each turns on conditions that can be checked, never on a date. The squares over each ideal show which are met. Nothing here is a forecast.'],
    ['Text', 'An old text set beside an ideal. That is this project’s reading, and each one says where the likeness stops. A text never proves anything about a movement.'],
    ['How it takes hold', 'A mechanism named in published scholarship, such as a self-fulfilling prophecy or engineered attachment, with recorded uses.'],
    ['Ancient pattern', 'What older traditions called a similar thing: the image made to speak, the oracle, the tower. Quoted from named translations.'],
    ['Offshoot', 'A group that came out of a community on the map but states no program the map records as an ideal. Shown with its public record only.'],
    ['Dotted line', 'A way of reading, not a finding. A solid line is a record.'],
    ['Record', 'One page for anything on the map: what it says, who says it, what happened, who pays, the other side, what is open, and every thread to the rest. Pick anything and choose \u201cRead it as a page\u201d.']
  ];
  var FLAGS = [
    ['machine-checked at the source', 'A model opened the speaker’s own page and found the words.'],
    ['machine-checked on a relay or coverage', 'A model found the words only in an interview, a transcript, a news story or a repost.'],
    ['not yet checked', 'Nobody has checked it. That does not make it false.'],
    ['re-read by a person', 'A person opened the page and compared it with the map, on the date shown.']
  ];
  var VIEWS = [
    ['Ideals', 'tab-ideals', 'The stated aims, one card each: who carries it, one voice from its record, and where it stands.'],
    ['Alignment methods', 'tab-methods', 'The ways people propose to make AI behave, each asked the same five questions.'],
    ['Money and evaluators', 'tab-money', 'Who funds whom, and who tests the AI companies, with who pays the testers. A record of money is not a finding about motive.'],
    ['The ancients', 'tab-ancients', 'How each ideal takes hold of people, and what older traditions called the same pattern. This project’s reading, labelled as such.'],
    ['Timeline', 'tab-timeline', 'Everything with a date, in order, newest first.'],
    ['The Watch', 'tab-watch', 'Claims going around now, and what checking has found so far. A claim there is not a finding.']
  ];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  /* 2026-11-18 -> 18 November 2026; a year or a month alone stays as it is given. */
  ns.longDate = function (d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
    return m ? (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] : String(d || '');
  };

  /* Under every record and every claim: how to cite it and, once the map takes issues (meta.contribute), how to
     answer it. A GitHub new-issue address opens the correction form with the record filled in. */
  function replyUrl(base, o) {
    var gh = /^(https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/new)/.exec(base);
    if (!gh) return base;
    return gh[1] + '?template=correction.yml&title=' + encodeURIComponent('Correction: ' + o.title) + '&record=' + encodeURIComponent(o.id + ' (' + o.title + ')');
  }
  ns.citeText = function (ix, o) {
    var m = ix.g.meta || {};
    var base = m.site_url ? String(m.site_url).replace(/\/?$/, '/') : /^https?:$/.test(location.protocol) ? location.origin + location.pathname : '';
    return '“' + o.title + '”. The Ideals Map, record ' + o.id + (ix.g.updated ? ', as of ' + ns.longDate(ix.g.updated) : '') + '.' +
      (base ? ' ' + base + o.hash : '');
  };
  ns.recordFoot = function (ix, ui, o) {
    var m = ix.g.meta || {}, foot = ui.h('div', 'rec-foot');
    var text = ns.citeText(ix, o), p = ui.h('p', 'cite-line');
    ui.add(p, ui.h('span', 'card-k', 'Cite: '), ui.h('span', 'cite-text', text));
    if (navigator.clipboard && window.isSecureContext) {
      var b = ui.h('button', 'linkbtn copy-cite', 'Copy'); b.type = 'button';
      b.addEventListener('click', function () {
        navigator.clipboard.writeText(text + ' Accessed ' + new Date().toISOString().slice(0, 10) + '.').then(function () { b.textContent = 'Copied'; }, function () { b.textContent = 'Could not copy'; });
      });
      ui.add(p, ui.h('span', null, ' '), b);
    }
    ui.add(foot, p);
    if (m.contribute) ui.add(foot, ui.add(ui.h('p', 'reply-line'), ui.link(replyUrl(m.contribute, o), 'Reply to this record or correct it'),
      ui.h('span', null, ': a party’s response, a missing side, or a source that does not say what the map says. Do not name private people.')));
    return foot;
  };

  /* A page or file that ships with the site (ui.link draws only http(s) addresses as links). */
  function local(ui, href, text) { var a = ui.h('a', 'src', text); a.href = href; return a; }

  function homeIdeals(ix) {
    if (ix.homes) return ix.homes;
    var homes = {};
    (ix.g.ideals || []).forEach(function (d) {
      Object.keys(ns.members(ix, d.id)).forEach(function (m) { (homes[m] = homes[m] || []).push(d.id); });
    });
    ix.homes = homes;
    return homes;
  }

  ns.renderStart = function (box, ix, ui, nav) {
    while (box.firstChild) box.removeChild(box.firstChild);
    var m = ix.g.meta || {}, s = ix.g.sources || {};
    var intro = ui.h('div', 'watch-intro');
    ui.add(intro, ui.h('h2', null, 'How to read this map'),
      ui.h('p', 'lede', 'The map holds ' + (ix.g.ideals || []).length + ' stated aims for AI, from \u201ca made mind will save us\u201d to \u201ca made companion can be there for you\u201d, with the people and groups who carry them, what has happened, who pays, who checks the machines, and what older traditions called the same patterns. Pick the way in that fits where you are coming from, or go straight to any part below.'),
      ui.h('p', null, 'It is a record, not a verdict. Every item says who is speaking, quotes them, links the source and says how it was checked. Where something is only claimed or alleged, it says so. Read the sources and come to your own conclusion.'));
    ui.add(box, intro);

    /* Where are you coming from: a short path through the map for each kind of reader. */
    if (ns.hasDoors(ix)) {
      var doors = ui.h('nav', 'doors');
      doors.setAttribute('aria-label', 'Ways in, by where you are coming from');
      ns.renderDoorStrip(doors, ix, ui, nav);
      ui.add(box, doors);
    }

    var ways = ui.section('Everything on the map');
    var wl = ui.h('ul', 'links guide-ways');
    /* The heart is a page of its own; the single-file copy does not carry it. */
    if (!document.getElementById('graph-data')) ui.add(wl, ui.add(ui.h('li'), local(ui, 'heart.html', 'The heart'),
      ui.h('span', null, ': what the traditions saw, in a few minutes of reading. Start here if you want the why before the records.')));
    VIEWS.forEach(function (v) {
      var tab = document.getElementById(v[1]);
      if (tab && tab.hidden) return;
      var b = ui.h('button', 'linkbtn', v[0]);
      b.type = 'button';
      b.addEventListener('click', function () { tab.click(); });
      ui.add(wl, ui.add(ui.h('li'), b, ui.h('span', null, ': ' + v[2])));
    });
    if (ns.hasPeople(ix)) {
      var wb = ui.h('button', 'linkbtn', 'Who\u2019s who'); wb.type = 'button';
      wb.addEventListener('click', function () { nav.goPeople(null); });
      ui.add(wl, ui.add(ui.h('li'), wb, ui.h('span', null, ': every public figure named here, in one plain sentence. Any underlined name anywhere opens the same sentence.')));
    }
    ui.add(box, ui.add(ways, wl));

    var kept = ui.section('How this record is kept');
    var kl = ui.h('ol', 'kept');
    ['AI agents do the first pass. Every week one searches for new claims and events about the names here, opens the sources and drafts records. Nothing it drafts goes on the map until a person decides.',
      'A second model checks each draft against its sources and marks how: at the speaker\u2019s own page, only on a relay, or not at all.',
      'A person re-reads the sources, page by page, starting with claims about named people. Each record shows how far that has got.',
      'Anyone can point out a mistake or a missing side. The record changes; the change is kept.'].forEach(function (t) { ui.add(kl, ui.h('li', null, t)); });
    ui.add(kept, kl, ui.h('p', 'note', 'Every record carries this as its trail: drafted \u2192 checked by a model \u2192 re-read by a person. It is not a wiki: the map does not speak in one smoothed-over voice. Every line says who is speaking and where it was checked.'));
    ui.add(box, kept);

    var gl = ui.section('The words this map uses'), dl = ui.h('dl', 'glossary');
    GLOSSARY.forEach(function (g) { ui.add(dl, ui.h('dt', null, g[0]), ui.h('dd', null, g[1])); });
    ui.add(box, ui.add(gl, dl));

    var fl = ui.section('How far the checking has got', 'Models made by Anthropic gathered and checked these records; Anthropic is itself on the map. Each source carries one of these marks.');
    var fd = ui.h('dl', 'glossary');
    FLAGS.forEach(function (f) { ui.add(fd, ui.add(ui.h('dt'), ui.h('span', 'badge', f[0])), ui.h('dd', null, f[1])); });
    ui.add(fl, fd);
    if (s.pages) ui.add(fl, ui.h('p', 'progress', 'A person has re-read ' + (s.reread || 0) + ' of the ' + s.pages + ' pages this map cites.'));
    ui.add(box, fl);

    var not = ui.section('What this map does not do');
    var nl = ui.h('ul');
    ['It does not call anyone a cult, a fraud or a believer. Those words appear only inside someone’s quotation, with their name on it.',
      'It does not name private people. Members, accusers, victims and defendants who are not public figures are named by role only.',
      'It does not forecast. A phase turns when its conditions are met, and the unmet conditions are what to watch.',
      'It does not say any ancient text foretold anyone.'].forEach(function (t) { ui.add(nl, ui.h('li', null, t)); });
    ui.add(box, ui.add(not, nl));

    var more = ui.section('Send a claim or a correction; use the data');
    if (m.contribute) ui.add(more, ui.add(ui.h('p'), ui.h('span', null, 'Seen a claim going around, or found a mistake? '),
      ui.link(m.contribute, 'Open an issue'), ui.h('span', null, ' with the words, who said them, and a link. Do not name private people.')));
    if (!document.getElementById('graph-data')) ui.add(more, ui.add(ui.h('p'), ui.h('span', null, 'Researchers: every record is published as '),
      local(ui, 'data/graph.json', 'one JSON file'), ui.h('span', null, ' and as '), local(ui, 'data/ideals-map-data.zip', 'CSV tables'),
      ui.h('span', null, ', with '), local(ui, 'data/DATA.md', 'a guide to every field'), ui.h('span', null, '.')));
    if (m.made_with) ui.add(more, ui.h('p', 'note', m.made_with));
    if (more.children.length > 1) ui.add(box, more);
  };

  /* Everything dated, newest first: events from the map, and claims from the Watch marked as claims. */
  ns.renderTimeline = function (box, ix, ui, nav, filter) {
    while (box.firstChild) box.removeChild(box.firstChild);
    filter = filter || { what: 'all', ideal: '' };
    var homes = homeIdeals(ix);
    var rows = [];
    (ix.g.fruits || []).forEach(function (f) { rows.push({ kind: 'event', date: String(f.date || ''), n: f, ideals: homes[f.id] || [] }); });
    (ix.g.watch || []).forEach(function (w) {
      /* A claim stands under an ideal only where it names that ideal or one of its events: no association by neighbourhood. */
      var on = {};
      (w.touches || []).forEach(function (t) {
        var n = ix.byId[t];
        if (n && n.type === 'ideal') on[t] = true;
        else if (n && n.type === 'fruit') (homes[t] || []).forEach(function (d) { on[d] = true; });
      });
      rows.push({ kind: 'claim', date: String(w.date || ''), n: w, ideals: Object.keys(on) });
    });
    rows = rows.filter(function (r) {
      return (filter.what === 'all' || filter.what === r.kind) && (!filter.ideal || r.ideals.indexOf(filter.ideal) >= 0);
    }).sort(function (a, b) { return b.date.localeCompare(a.date); });

    var intro = ui.h('div', 'watch-intro');
    ui.add(intro, ui.h('h2', null, 'Timeline'),
      ui.h('p', null, 'Everything on the map that has a date, newest first. Events carry a source and say whether they are documented, reported or alleged. Claims from the Watch are marked as claims: a claim is not a finding.'));
    var bar = ui.h('div', 'tl-filters');
    var what = ui.h('select'); what.setAttribute('aria-label', 'Show');
    [['all', 'Events and claims'], ['event', 'Events only'], ['claim', 'Claims on the Watch only']].forEach(function (o) {
      var op = ui.h('option', null, o[1]); op.value = o[0]; if (filter.what === o[0]) op.selected = true; ui.add(what, op); });
    var ideal = ui.h('select'); ideal.setAttribute('aria-label', 'Ideal');
    var any = ui.h('option', null, 'Every ideal'); any.value = ''; ui.add(ideal, any);
    (ix.g.ideals || []).forEach(function (d) { var op = ui.h('option', null, d.label); op.value = d.id; if (filter.ideal === d.id) op.selected = true; ui.add(ideal, op); });
    function again() { ns.renderTimeline(box, ix, ui, nav, { what: what.value, ideal: ideal.value }); }
    what.addEventListener('change', again); ideal.addEventListener('change', again);
    ui.add(bar, what, ideal, ui.h('span', 'note', rows.length + ' shown'));
    ui.add(intro, bar);
    ui.add(box, intro);

    var year = null, list = null;
    rows.forEach(function (r) {
      var y = r.date.slice(0, 4) || 'Undated';
      if (y !== year) { year = y; ui.add(box, ui.h('h3', 'tl-year', y)); list = ui.h('ol', 'timeline'); ui.add(box, list); }
      var li = ui.h('li', 'tl-item tl-' + r.kind), n = r.n;
      var head = ui.h('p', 'tl-head');
      ui.add(head, ui.h('time', null, r.date),
        ui.h('span', 'lane', r.kind === 'claim' ? 'claim · ' + ((ns.watchStatus || {})[n.status] || n.status) : n.kind));
      var title = ui.h('button', 'linkbtn tl-title', r.kind === 'claim' ? n.title : (n.label || n.what));
      title.type = 'button';
      title.addEventListener('click', function () { if (r.kind === 'claim') nav.goWatch(n.id); else nav.goRecord(n.id); });
      ui.add(li, head, title);
      if (r.kind === 'event' && n.what && n.what !== n.label) ui.add(li, ui.h('p', 'tl-what', n.what));
      if (r.kind === 'claim') ui.add(li, ui.h('p', 'tl-what', n.claimed_by + ': “' + n.claim + '”'));
      var src = ui.h('p', 'cite');
      ui.add(src, ui.link(n.url, n.source || 'source', n.nolink), ui.h('span', null, ' '), r.kind === 'event' ? ui.badge(n.verified, n.url) : null);
      if (r.ideals.length) {
        ui.add(src, ui.h('span', null, ' · '));
        r.ideals.forEach(function (id, i) {
          var b = ui.h('button', 'linkbtn', ix.byId[id].label);
          b.type = 'button';
          b.addEventListener('click', function () { nav.go(id); });
          ui.add(src, i ? ui.h('span', null, ', ') : null, b);
        });
      }
      ui.add(li, src);
      ui.add(list, li);
    });
  };

  /* Search every name, event and claim. Picking one opens it where it lives. */
  ns.initSearch = function (input, list, ix, nav) {
    var items = [];
    Object.keys(ix.byId).forEach(function (id) {
      var n = ix.byId[id];
      var name = n.label || n.ref || id;
      items.push({ id: id, name: name, rank: n.type === 'fruit' || n.type === 'text' ? 1 : 0, word: ns.typeWord[n.type] || n.type,
        hay: (name + ' ' + (n.what || '') + ' ' + (n.quote || '')).toLowerCase() });
    });
    (ix.g.methods || []).forEach(function (m) {
      items.push({ id: m.id, name: m.label, rank: 0, word: 'Alignment method', hay: (m.label + ' ' + m.plain).toLowerCase() });
    });
    (ix.g.people || []).forEach(function (p) {
      items.push({ id: p.id, person: true, name: p.name, rank: 0, word: 'Who\u2019s who', hay: (p.name + ' ' + (p.match || []).join(' ') + ' ' + p.who).toLowerCase() });
    });
    (ix.g.watch || []).forEach(function (w) {
      items.push({ id: w.id, watch: true, name: w.title, rank: 1, word: 'Claim on the Watch', hay: (w.title + ' ' + w.claimed_by + ' ' + w.claim + ' ' + (w.source || '')).toLowerCase() });
    });
    var hits = [], at = -1;
    function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); at = -1; }
    function choose(it) {
      close(); input.value = ''; input.blur();
      if (it.watch) nav.goWatch(it.id); else nav.goRecord(it.id);
    }
    function mark() {
      [].forEach.call(list.children, function (li, i) { li.setAttribute('aria-selected', i === at ? 'true' : 'false'); });
      if (at >= 0) input.setAttribute('aria-activedescendant', 'hit-' + at); else input.removeAttribute('aria-activedescendant');
    }
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      while (list.firstChild) list.removeChild(list.firstChild);
      if (q.length < 2) { close(); return; }
      /* Names that match come first (a name that starts with the words, then one that holds them), then names over events. */
      function score(it) { var i = it.name.toLowerCase().indexOf(q); return (i === 0 ? 0 : i > 0 ? 1 : 2) * 2 + it.rank; }
      hits = items.filter(function (it) { return it.hay.indexOf(q) >= 0; })
        .sort(function (a, b) { return score(a) - score(b) || a.name.localeCompare(b.name); })
        .slice(0, 12);
      if (!hits.length) { var none = document.createElement('li'); none.className = 'hit-none'; none.textContent = 'Nothing on the map matches.'; list.appendChild(none); }
      hits.forEach(function (it, i) {
        var li = document.createElement('li');
        li.id = 'hit-' + i; li.setAttribute('role', 'option');
        var nm = document.createElement('span'); nm.textContent = it.name;
        var wd = document.createElement('span'); wd.className = 'hit-word'; wd.textContent = it.word;
        li.appendChild(nm); li.appendChild(wd);
        li.addEventListener('mousedown', function (ev) { ev.preventDefault(); choose(it); });
        list.appendChild(li);
      });
      list.hidden = false; input.setAttribute('aria-expanded', 'true'); at = -1; mark();
    });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown' && hits.length) { at = Math.min(at + 1, hits.length - 1); mark(); ev.preventDefault(); }
      else if (ev.key === 'ArrowUp' && hits.length) { at = Math.max(at - 1, 0); mark(); ev.preventDefault(); }
      else if (ev.key === 'Enter' && hits.length) { choose(hits[Math.max(at, 0)]); ev.preventDefault(); }
      else if (ev.key === 'Escape') { close(); }
    });
    input.addEventListener('blur', function () { setTimeout(close, 100); });
  };
})(window.IdealsMap = window.IdealsMap || {});
