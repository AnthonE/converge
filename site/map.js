/* Ideals Map: state, side panel, list view, boot. */
(function (ns) {
  'use strict';

  var VERIFIED = { primary: 'machine-checked at the source', secondary: 'machine-checked on a relay or coverage', unverified: 'not yet checked' };
  var KIND = { documented: 'documented', reported: 'reported', alleged: 'alleged' };
  var ix, state = { view: 'cards', ideal: null, selected: null, edge: null };
  /* The ideals open as cards; a reader who picks the drawing keeps it until they pick cards again. */
  var idealsMode = 'cards';
  var svg, panel, tip, stage;

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function add(parent) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]); return parent; }

  /* nolink: a carrier's own sign-up or sales site is named as the source but never linked. */
  function link(url, text, nolink) {
    if (nolink || !/^https?:\/\//.test(url || '')) return h('span', 'src', text);
    var a = h('a', 'src', text);
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    return a;
  }
  /* The machine's flag, and, once a person has opened the page and compared it with the map, that too. It shows as a
     short mark; a tap shows the full words, which screen readers always hear. Record pages (r/) spell it out. */
  var SHORT = { primary: 'at the source', secondary: 'on a relay', unverified: 'not checked' };
  function badge(v, url) {
    var r = url && ix.reread[url], full, short, cls;
    if (r && (r.result === 'holds' || r.result === 'corrected')) {
      full = (VERIFIED[v] || VERIFIED.unverified) + ' · re-read by a person, ' + r.date; short = 're-read by a person'; cls = 'badge badge-reread';
    } else {
      full = VERIFIED[v] || VERIFIED.unverified; short = SHORT[v] || SHORT.unverified; cls = 'badge badge-' + (v || 'unverified');
    }
    var b = h('button', cls, short);
    b.type = 'button'; b.title = full;
    b.setAttribute('aria-label', 'How it was checked: ' + full);
    b.addEventListener('click', function (ev) { ev.stopPropagation(); b.textContent = b.textContent === short ? full : short; });
    return b;
  }
  function section(title, note) {
    var s = h('section', 'sec');
    add(s, h('h3', null, title));
    if (note) add(s, h('p', 'note', note));
    return s;
  }

  function linkList(edges) {
    var ul = h('ul', 'links');
    edges.forEach(function (e) {
      var li = h('li', e.lens ? 'is-lens' : null);
      var b = h('button', 'linkbtn', e.sentence || (ix.byId[e.from].label + ' ' + e.type + ' ' + (ix.byId[e.to].label || ix.byId[e.to].ref)));
      b.type = 'button';
      b.addEventListener('click', function () { state.edge = e.i; render(); });
      add(li, b);
      if (e.lens) add(li, h('span', 'lane', 'lens'));
      add(ul, li);
    });
    return ul;
  }

  function quoteList(words) {
    var box = h('div', 'quotes');
    (words || []).forEach(function (w) {
      var q = h('blockquote', null, '“' + w.quote + '”');
      var c = h('p', 'cite');
      add(c, h('span', null, w.speaker + ', '), link(w.url, w.source, w.nolink), h('span', null, w.date ? ' (' + w.date + ') ' : ' '), badge(w.verified, w.url));
      add(box, q, c);
    });
    return box;
  }

  function idealPanel(d, drawn) {
    var root = h('div');
    add(root, h('p', 'kicker', 'Ideal'), h('h2', null, d.label), h('p', 'statement', d.ideal));
    if (d.summary) add(root, h('p', null, d.summary));

    var ph = section('Where it stands', 'Phases turn on conditions you could observe, not on dates. Filled means met, half means partly, hollow means not met, dotted means unknown.');
    (ix.g.phases || []).forEach(function (p) {
      var entry = (d.phases || []).filter(function (x) { return x.phase === p.phase; })[0];
      var row = h('div', 'phase');
      add(row, h('h4', null, p.phase + ' · ' + p.name), h('p', 'note', p.what));
      var ul = h('ul', 'conds');
      ((entry && entry.conditions) || []).forEach(function (c) {
        var li = h('li', 'cond cond-' + c.status);
        add(li, add(h('span', 'glyph'), ns.pipIcon(c.status)), h('span', 'sr', ns.phaseWord[c.status] + ': '), h('span', null, c.text));
        if (c.evidence) add(li, h('span', 'evidence', ' ' + c.evidence + ' '));
        if (c.context) add(li, h('span', 'lane', 'context, not counted'));
        if (c.url && !c.nolink) add(li, link(c.url, 'source'));
        add(ul, li);
      });
      if (!entry || !(entry.conditions || []).length) add(ul, add(h('li', 'cond cond-unknown'), add(h('span', 'glyph'), ns.pipIcon('unknown')), h('span', null, 'nothing recorded')));
      add(row, ul); add(ph, row);
    });
    add(root, ph);

    if ((d.words || []).length) add(root, add(section('Quoted words', 'Carriers, observers and critics. Each line names its speaker.'), quoteList(d.words)));

    /* Only the links drawn in this view, the ideal's own first. */
    var mem = ns.members(ix, d.id);
    var own = drawn.filter(function (e) { return e.from === d.id || e.to === d.id; });
    var rest = drawn.filter(function (e) { return e.from !== d.id && e.to !== d.id; });
    add(root, add(section('How it links', 'Each line is one link on the map, read as a sentence.'), linkList(own.concat(rest))));

    /* Names under this ideal that have a money record. The detail is in the money view. */
    var paid = Object.keys(mem).map(function (m) { return ix.byId[m]; }).filter(function (n) {
      return n.type !== 'ideal' && ns.hasMoney(ix, n.id);
    });
    if (paid.length) {
      var ms = section('Money and evaluators', 'Names in this view with a money record: who funds, hosts or evaluates them, or what they fund or host. A record of money is not a finding about anyone\u2019s work or motive.');
      var ml = h('ul', 'links');
      paid.forEach(function (n) {
        var count = ix.adj[n.id].filter(function (l) { return ns.isMoney(l.edge); }).length;
        var b = h('button', 'linkbtn money-link', n.label + ': ' + count + (count === 1 ? ' record' : ' records')), li = h('li');
        b.type = 'button';
        b.addEventListener('click', function () { goMoney(n.id); });
        add(ml, add(li, b));
      });
      add(root, add(ms, ml));
    }
    /* Older texts this project reads beside the ideal: after the record of who and what, never before it.
       Each names its tradition and translation and carries the reading, which says where the likeness stops. */
    var texts = ns.byTradition(Object.keys(mem).map(function (m) { return ix.byId[m]; }).filter(function (n) { return n.type === 'text'; }));
    if (texts.length) {
      var trads = [];
      texts.forEach(function (t) { var k = ns.tradition(t); if (trads.indexOf(k) < 0) trads.push(k); });
      var ts = section('Older texts read beside it (' + texts.length + ')', 'This project’s readings, from ' + trads.join(', ') +
        '. A text can motivate a question. It never confirms a mechanism or a source, and nothing here says a text foretold anyone.');
      texts.forEach(function (t) {
        var read = (ix.adj[t.id] || []).filter(function (l) { return l.other === d.id && l.edge.type === 'parallels'; })[0];
        add(ts, h('blockquote', null, '“' + t.quote + '”'), h('p', 'cite', ns.textCite(t) + (t.proposed ? ' (proposed parallel)' : '')));
        if (read && read.edge.sentence) add(ts, h('p', 'note', read.edge.sentence));
      });
      add(root, ts);
    }
    if (ns.hasAncients(ix) && ns.ancientLines(ix).some(function (l) { return l.from === d.id; })) {
      var an = h('button', 'more-btn', 'Line it up with the ancients');
      an.type = 'button';
      an.addEventListener('click', function () { goAncients(d.id); });
      add(root, add(section('What the ancients called it', 'Its patterns, how it takes hold, and the field key, in the ancients view.'), an));
    }
    if ((d.cautions || []).length) {
      var cs = section('Cautions'), ul = h('ul');
      d.cautions.forEach(function (c) { add(ul, h('li', null, c)); });
      add(root, add(cs, ul));
    }
    return root;
  }

  function nodePanel(n, drawn) {
    var root = h('div');
    add(root, h('p', 'kicker', ns.typeWord[n.type]), h('h2', null, n.label || n.ref));
    if (n.type === 'fruit') {
      add(root, h('p', 'statement', n.what));
      var p = h('p', 'cite');
      add(p, h('span', null, n.date + ' · ' + (KIND[n.kind] || n.kind) + ' · '), link(n.url, n.source || 'source', n.nolink), h('span', null, ' '), badge(n.verified, n.url));
      add(root, p);
    } else if (n.type === 'offshoot') {
      add(root, h('p', 'cite', n.status));
      if (n.note) add(root, h('p', null, n.note));
      add(root, h('p', 'loop', 'Why it is not an ideal here: ' + n.why_not));
      var came = ix.adj[n.id].filter(function (l) { return l.edge.type === 'breaks_from' && l.edge.from === n.id; });
      if (came.length) {
        var cs2 = section('Where it came from', 'The record of lineage. It says where the group came from, not that the community or any ideal caused what followed.'), cl = h('ul', 'links');
        came.forEach(function (l) {
          var li = h('li', 'flow'), e = l.edge;
          add(li, h('span', null, e.sentence + ' '), link(e.url, e.source || 'source', e.nolink), h('span', null, ' '), h('span', 'lane', KIND[e.kind] || e.kind), h('span', null, ' '), badge(e.verified, e.url));
          add(cl, li);
        });
        add(root, add(cs2, cl));
      }
      if ((n.record || []).length) {
        var rs = section('On the record', 'Every legal matter is given as charged, pending or decided, or unknown where no outcome was found. A charge is not a finding.'), rl = h('ul', 'links');
        n.record.forEach(function (r) {
          var li = h('li', 'happened');
          add(li, h('span', null, r.date + ': ' + r.what + ' '), r.status ? h('span', 'lane', r.status) : null, h('span', null, ' '),
            link(r.url, r.source || 'source', r.nolink), h('span', null, ' '), h('span', 'lane', KIND[r.kind] || r.kind), h('span', null, ' '), badge(r.verified, r.url));
          add(rl, li);
        });
        add(root, add(rs, rl));
      }
      var other = ix.adj[n.id].filter(function (l) { return l.edge.type !== 'breaks_from'; });
      if (other.length) {
        var os2 = section('Other links on the record'), ox = h('ul', 'links');
        other.forEach(function (l) {
          var li = h('li', 'flow'), e = l.edge;
          add(li, h('span', null, e.sentence + ' '), e.source ? link(e.url, e.source, e.nolink) : null, h('span', null, ' '),
            e.kind ? h('span', 'lane', KIND[e.kind] || e.kind) : null, h('span', null, ' '), e.verified ? badge(e.verified, e.url) : null);
          add(ox, li);
        });
        add(root, add(os2, ox));
      }
      if ((n.cautions || []).length) { var oc = section('Cautions'), ol = h('ul'); n.cautions.forEach(function (c) { add(ol, h('li', null, c)); }); add(root, add(oc, ol)); }
    } else if (n.type === 'text') {
      var tc = h('p', 'cite');
      add(tc, h('span', null, ns.tradition(n) + ' · ' + (n.translation || 'King James Version') + ' '));
      if (n.url) add(tc, link(n.url, 'source'), h('span', null, ' '), badge(n.verified, n.url));
      add(root, h('blockquote', null, '“' + n.quote + '”'), tc,
        h('p', 'note', 'A text can motivate a question. It never confirms a mechanism or a source.'));
    } else {
      if (n.kind || n.status) add(root, h('p', 'cite', [n.kind, n.status].filter(Boolean).join(' · ')));
      if (n.note) add(root, h('p', null, n.note));
      if ((n.words || []).length) add(root, add(section('In their own words'), quoteList(n.words)));
    }
    add(root, add(section('How it links'), linkList(drawn.filter(function (e) { return e.from === n.id || e.to === n.id; }))));
    /* Every event that hangs on this name, drawn in this view or not. */
    var events = n.type === 'fruit' ? [] : ix.adj[n.id].filter(function (l) { return l.edge.type === 'bears_fruit' && l.edge.from === n.id; })
      .map(function (l) { return ix.byId[l.other]; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    if (events.length) {
      var es = section('What happened (' + events.length + ')'), el = h('ul', 'links');
      events.forEach(function (f) {
        var li = h('li', 'happened');
        li.setAttribute('data-event', f.id);
        add(li, h('span', null, f.date + ': ' + f.what + ' '), link(f.url, f.source || 'source', f.nolink), h('span', null, ' '),
          h('span', 'lane', KIND[f.kind] || f.kind), h('span', null, ' '), badge(f.verified, f.url));
        add(el, li);
      });
      add(root, add(es, el));
    }
    if (ns.hasAncientLinks && ns.hasAncientLinks(ix, n.id)) {
      var an = h('button', 'more-btn', 'Line it up with the ancients');
      an.type = 'button';
      an.addEventListener('click', function () { goAncients(n.id); });
      add(root, add(section('The ancients'), an));
    }
    if (ns.hasMoney(ix, n.id)) {
      var m = h('button', 'more-btn', 'Its records of money, hosting and evaluation');
      m.type = 'button';
      m.addEventListener('click', function () { goMoney(n.id); });
      add(root, add(section('Money and evaluators'), m));
    }
    return root;
  }

  function edgePanel(e) {
    var root = h('div');
    add(root, h('p', 'kicker', 'Link' + (e.lens ? ' · interpretive lens' : '')), h('p', 'statement', e.sentence || e.type));
    if (e.lens) add(root, h('p', 'note', 'This link is a way of reading, not a finding. It claims no shared mechanism.'));
    if (e.source) add(root, add(h('p', 'cite'), link(e.url, e.source)));
    return root;
  }

  function introPanel() {
    var root = h('div'), m = ix.g.meta || {};
    add(root, h('p', 'kicker', 'How to read this'), h('h2', null, m.title || 'The Ideals Map'),
      h('p', null, 'Each large circle is an ideal: the end a movement serves. Pick one to see who carries it, what it runs on, what has happened, and the old texts this project reads beside it.'),
      h('p', null, 'The six squares over each ideal are its phases. Nothing here is a forecast. A phase turns when its conditions are met, and the conditions still unmet are what to watch.'),
      h('p', 'note', m.note || ''), h('p', 'note', m.made_with || ''));
    var off = (ix.g.offshoots || []).slice().sort(function (a, b) { return a.label.localeCompare(b.label); });
    if (off.length) {
      var s = section('Offshoots (' + off.length + ')', 'Groups that came out of a community on this map and state no program the map records as an ideal. Each is shown with its public record and every matter’s status. Coming out of a community is not being caused by it.');
      var ul = h('ul', 'links');
      off.forEach(function (o) {
        var b = h('button', 'linkbtn', o.label);
        b.type = 'button'; b.setAttribute('data-offshoot', o.id);
        b.addEventListener('click', function () { state.selected = o.id; state.edge = null; render(); });
        var from = ix.adj[o.id].filter(function (l) { return l.edge.type === 'breaks_from' && l.edge.from === o.id; }).map(function (l) {
          var t = ix.byId[l.other]; return (t.label || t.ref) + ' (' + (ns.typeWord[t.type] || t.type).toLowerCase() + ')'; });
        add(ul, add(h('li'), b, h('span', null, (from.length ? ' came out of ' + from.join(', ') + '. ' : ' ') + (o.status || ''))));
      });
      add(root, add(s, ul));
    }
    return root;
  }

  /* What the money view needs from this file. */
  var ui = { h: h, add: add, link: link, badge: badge, section: section, quoteList: quoteList,
    select: function (id) { goMoney(id); }, go: function (id) { go(id); } };
  var uiA = { h: h, add: add, link: link, badge: badge, section: section, quoteList: quoteList,
    select: function (id) { goAncients(id); }, go: function (id) { go(id); } };

  /* Redrawing destroys the focused element, so put keyboard focus back where it was. */
  function render() {
    /* The page says which view is open; on a phone the header's long sentence shows on the front only. */
    document.documentElement.setAttribute('data-view', state.view);
    var act = document.activeElement, kb = act && act.matches && act.matches(':focus-visible');
    var id = kb && svg.contains(act) ? act.getAttribute('data-id') : null;
    var ours = kb && (svg.contains(act) || panel.contains(act) || act.id === 'to-overview' || document.getElementById('the-watch').contains(act));
    if (state.view === 'watch') { paintWatch(); return; }
    if (/^(cards|start|timeline|people|words|record|methods|door)$/.test(state.view)) { paintPage(); return; }
    document.getElementById('the-watch').hidden = true;
    document.getElementById('the-page').hidden = true;
    document.getElementById('tab-timeline').setAttribute('aria-pressed', 'false');
    document.getElementById('tab-methods').setAttribute('aria-pressed', 'false');
    document.getElementById('layout').hidden = false;
    document.getElementById('tab-watch').setAttribute('aria-pressed', 'false');
    showChrome(state.view === 'overview', true);
    paint();
    var again = id && svg.querySelector('[data-id="' + id + '"]');
    if (again) again.focus();
    else if (ours) { panel.setAttribute('tabindex', '-1'); panel.focus(); }
  }
  /* On a narrow screen the map is wider than the page and scrolls sideways: bring what the reader opened into view. */
  function centreOnPhone() {
    var wide = stage.scrollWidth > stage.clientWidth + 1;
    document.getElementById('drag-hint').hidden = stage.scrollWidth < stage.clientWidth + 60;
    if (!wide) { pinMore(); return; }
    var focal = (state.selected && svg.querySelector('[data-id="' + state.selected + '"]')) ||
      svg.querySelector('.node.role-centre, .node.role-money-centre');
    var s = svg.getBoundingClientRect(), x = s.width / 2;
    if (focal) { var b = focal.getBoundingClientRect(); x = b.left - s.left + b.width / 2; }
    stage.scrollLeft = Math.max(0, x - stage.clientWidth / 2);
    pinMore();
  }
  /* The line under the drawing ("N more linked items are in the list below") stays in view while it is dragged. */
  function pinMore() { document.getElementById('more').style.transform = stage.scrollLeft ? 'translateX(' + stage.scrollLeft + 'px)' : ''; }
  function paint() {
    var money = state.view === 'money', anc = state.view === 'ancients';
    var layout = money ? ns.money(ix, state.selected) : anc ? ns.ancients(ix, state.selected) : state.view === 'focus' ? ns.focus(ix, state.ideal) : ns.overview(ix);
    var drawn = layout.edges.map(function (e) { return e.edge; });
    ns.draw(svg, layout, ix, state, { node: onNode, edge: onEdge, tip: showTip, untip: hideTip });
    stage.setAttribute('data-view', state.view);
    centreOnPhone();
    document.getElementById('more').textContent = layout.dropped
      ? layout.dropped + ' more linked items are in the list below.' : '';
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    var body, back;
    if (anc) {
      if (state.edge !== null) body = ns.ancientsEdgePanel(ix, ns.ancientLine(ix, state.edge), uiA);
      else if (state.selected) body = ns.ancientsPanel(ix, ix.byId[state.selected], uiA);
      else body = ns.ancientsIntro(ix, uiA);
      if (state.edge !== null && state.selected) {
        back = h('button', 'back', '← ' + (ix.byId[state.selected].label || ix.byId[state.selected].ref));
        back.addEventListener('click', function () { state.edge = null; render(); });
      } else if (state.edge !== null || state.selected) {
        back = h('button', 'back', '← The whole line-up');
        back.addEventListener('click', function () { goAncients(null); });
      }
    } else if (money) {
      if (state.edge !== null) body = ns.moneyEdgePanel(ix, ix.g.edges[state.edge], ui);
      else if (state.selected) body = ns.moneyPanel(ix, ix.byId[state.selected], ui);
      else body = ns.moneyIntro(ix, ui);
      if (state.edge !== null && state.selected) {
        back = h('button', 'back', '← ' + (ix.byId[state.selected].label || ix.byId[state.selected].ref));
        back.addEventListener('click', function () { state.edge = null; render(); });
      } else if (state.edge !== null || state.selected) {
        back = h('button', 'back', '← All money and evaluators');
        back.addEventListener('click', function () { goMoney(null); });
      }
    } else {
      if (state.edge !== null) body = ns.isMoney(ix.g.edges[state.edge]) ? ns.moneyEdgePanel(ix, ix.g.edges[state.edge], ui) : edgePanel(ix.g.edges[state.edge]);
      else if (state.selected && state.selected !== state.ideal) body = nodePanel(ix.byId[state.selected], drawn);
      else if (state.ideal) body = idealPanel(ix.byId[state.ideal], drawn);
      else body = introPanel();
      if (state.edge !== null || (state.selected && state.selected !== state.ideal)) {
        back = h('button', 'back', '← ' + (state.ideal ? ix.byId[state.ideal].label : 'All ideals'));
        back.addEventListener('click', function () { state.selected = null; state.edge = null; render(); });
      }
    }
    if (back) { back.type = 'button'; add(panel, back); }
    /* Anything picked on a drawing can also be read as a page of its own. */
    var picked = state.edge === null && (state.selected || state.ideal);
    if (picked && ix.byId[picked]) {
      var asPage = h('button', 'as-page', 'Read it as a page \u2192'); asPage.type = 'button';
      asPage.addEventListener('click', function () { goRecord(picked); });
      add(panel, asPage);
    }
    add(panel, body);
    ns.annotate(panel, ix);
    panel.scrollTop = 0;
    document.getElementById('to-overview').hidden = state.view !== 'focus';
    document.getElementById('tab-ideals').setAttribute('aria-pressed', money || anc ? 'false' : 'true');
    document.getElementById('tab-money').setAttribute('aria-pressed', money ? 'true' : 'false');
    document.getElementById('tab-ancients').setAttribute('aria-pressed', anc ? 'true' : 'false');
    document.getElementById('legend-ideals').hidden = money || anc;
    document.getElementById('legend-money').hidden = !money;
    document.getElementById('legend-ancients').hidden = !anc;
    svg.setAttribute('aria-label', money ? 'Map of who pays, hosts and evaluates whom' : anc ? 'Ideals lined up with how they take hold and what the ancients called them' : 'Map of ideals and what links to them');
  }

  /* The Watch is a page of its own: a timeline of claims, not a drawing. */
  function paintWatch() {
    var box = document.getElementById('the-watch');
    document.getElementById('layout').hidden = true;
    document.getElementById('the-page').hidden = true;
    document.getElementById('tab-timeline').setAttribute('aria-pressed', 'false');
    document.getElementById('tab-methods').setAttribute('aria-pressed', 'false');
    showChrome(false, false);
    box.hidden = false;
    ['legend-ideals', 'legend-money', 'legend-ancients'].forEach(function (l) { document.getElementById(l).hidden = true; });
    document.getElementById('to-overview').hidden = true;
    ['tab-ideals', 'tab-money', 'tab-ancients'].forEach(function (t) { document.getElementById(t).setAttribute('aria-pressed', 'false'); });
    document.getElementById('tab-watch').setAttribute('aria-pressed', 'true');
    ns.renderWatch(box, ix, ui, openNode, null, state.selected);
    ns.annotate(box, ix, 'article.claim');
    var target = state.selected && document.getElementById('watch-' + state.selected);
    if (target) { target.setAttribute('tabindex', '-1'); target.scrollIntoView(); target.focus(); }
  }
  /* The guide and the timeline are pages, like the Watch: no drawing. */
  function paintPage() {
    var box = document.getElementById('the-page'), start = state.view === 'start', people = state.view === 'people', rec = state.view === 'record', words = state.view === 'words';
    var meth = state.view === 'methods', door = state.view === 'door';
    box.classList.toggle('is-wide', meth || state.view === 'cards');
    showChrome(state.view === 'cards', false);
    document.getElementById('tab-methods').setAttribute('aria-pressed', meth ? 'true' : 'false');
    document.getElementById('layout').hidden = true;
    document.getElementById('the-watch').hidden = true;
    box.hidden = false;
    box.setAttribute('aria-label', start ? 'Start here: how to read this map' : people ? 'Who\u2019s who' : words ? 'Words you\u2019ll meet' : rec ? 'A record' : state.view === 'cards' ? 'The ideals, as cards' : meth ? 'Alignment methods, side by side' : door ? 'A way in' : 'Timeline: everything dated, newest first');
    ['legend-ideals', 'legend-money', 'legend-ancients'].forEach(function (l) { document.getElementById(l).hidden = true; });
    document.getElementById('to-overview').hidden = true;
    ['tab-money', 'tab-ancients', 'tab-watch'].forEach(function (t) { document.getElementById(t).setAttribute('aria-pressed', 'false'); });
    document.getElementById('tab-ideals').setAttribute('aria-pressed', state.view === 'cards' ? 'true' : 'false');
    document.getElementById('tab-timeline').setAttribute('aria-pressed', state.view === 'timeline' ? 'true' : 'false');
    window.scrollTo(0, 0);
    if (state.view === 'cards') { ns.renderCards(box, ix, ui, nav); ns.annotate(box, ix, '.card'); return; }
    if (people) { ns.renderPeople(box, ix, ui, nav, state.selected); return; }
    if (words) { ns.renderWords(box, ix, ui, nav, state.selected); return; }
    if (rec) { ns.renderRecord(box, ix, ui, nav, state.selected); ns.annotate(box, ix, '.rec-head, section', state.selected); return; }
    if (meth) { ns.renderMethods(box, ix, ui, nav); ns.annotate(box, ix, 'tr'); return; }
    if (door) { ns.renderDoor(box, ix, ui, nav, state.selected); return; }
    if (start) { ns.renderStart(box, ix, ui, nav); ns.annotate(box, ix); }
    else { ns.renderTimeline(box, ix, ui, nav); ns.annotate(box, ix, 'li.tl-item'); }
  }
  /* The cards/drawing switch shows on the ideals' opening view; the key, on any drawing. */
  function showChrome(modebar, key) {
    document.getElementById('modebar').hidden = !modebar;
    document.getElementById('mode-cards').setAttribute('aria-pressed', state.view === 'cards' ? 'true' : 'false');
    document.getElementById('mode-drawing').setAttribute('aria-pressed', state.view === 'overview' ? 'true' : 'false');
    document.getElementById('key').hidden = !key;
  }
  function goStart() { state.view = 'start'; state.ideal = null; state.selected = null; state.edge = null; setHash('#start'); render(); }
  function goTimeline() { state.view = 'timeline'; state.ideal = null; state.selected = null; state.edge = null; setHash('#timeline'); render(); }
  /* A record: one page for anything on the map, at a link that can be shared. */
  function goMethods() { state.view = 'methods'; state.ideal = null; state.edge = null; state.selected = null; setHash('#methods'); render(); }
  function goDoor(id) { state.view = 'door'; state.ideal = null; state.edge = null; state.selected = id; setHash('#door/' + id); render(); }
  function goView(v) {
    if (v === 'heart') { location.href = 'heart.html'; return; }
    ({ ideals: function () { go(null); }, methods: goMethods, money: function () { goMoney(null); }, ancients: function () { goAncients(null); },
      timeline: goTimeline, watch: function () { goWatch(null); }, people: function () { goPeople(null); }, words: function () { goWords(null); }, start: goStart }[v] || function () { go(null); })();
  }
  function goRecord(id) { state.view = 'record'; state.ideal = null; state.edge = null; state.selected = id; setHash('#r/' + id); render(); }
  function goWords(id) { state.view = 'words'; state.ideal = null; state.edge = null; state.selected = id || null; setHash(id ? '#words/' + id : '#words'); render(); }
  function goPeople(id) { state.view = 'people'; state.ideal = null; state.edge = null; state.selected = id || null; setHash(id ? '#people/' + id : '#people'); render(); }
  var nav = { go: function (id) { go(id); }, openNode: function (id) { openNode(id); }, goWatch: function (id) { goWatch(id); }, goPeople: function (id) { goPeople(id); }, goWords: function (id) { goWords(id); }, goRecord: function (id) { goRecord(id); }, goMoney: function (id) { goMoney(id); },
    goMethods: function () { goMethods(); }, goDoor: function (id) { goDoor(id); }, goView: function (v) { goView(v); } };
  function goWatch(id) {
    state.view = 'watch'; state.ideal = null; state.edge = null;
    state.selected = id && (ix.g.watch || []).some(function (w) { return w.id === id; }) ? id : null;
    setHash(state.selected ? '#watch/' + state.selected : '#watch');
    render();
  }
  /* From the Watch to a name on the map: its ideal's view if it has one, else the ancients or money view. */
  function openNode(id) {
    var n = ix.byId[id];
    if (!n) return;
    if (n.type === 'ideal') { go(id); return; }
    if (/^(pattern|mechanism)$/.test(n.type)) { goAncients(id); return; }
    /* An older text is not drawn on an ideal's map; its own page shows it with every reading that cites it. */
    if (n.type === 'text') { goRecord(id); return; }
    if (/^(funder|lab|evaluator)$/.test(n.type) && ns.hasMoney(ix, id)) { goMoney(id); return; }
    var home = (ix.g.ideals || []).find(function (d) { return ns.members(ix, d.id)[id]; });
    if (home) { go(home.id); state.selected = id; render(); return; }
    if (ns.hasAncientLinks(ix, id)) { goAncients(id); return; }
    if (ns.hasMoney(ix, id)) { goMoney(id); return; }
    goRecord(id);
  }

  function setHash(want) {
    if (location.hash !== want) { try { history.replaceState(null, '', want || location.pathname + location.search); } catch (err) { /* file:// */ } }
  }
  function go(idealId) {
    state.view = idealId ? 'focus' : idealsMode === 'drawing' ? 'overview' : 'cards';
    state.ideal = idealId || null; state.selected = null; state.edge = null;
    setHash(idealId ? '#' + idealId : idealsMode === 'drawing' ? '#drawing' : '');
    render();
  }
  /* The money view. With an id it turns to that name alone. */
  function goMoney(id) {
    state.view = 'money'; state.ideal = null; state.edge = null;
    state.selected = ns.hasMoney(ix, id) ? id : null;
    setHash(state.selected ? '#money/' + state.selected : '#money');
    render();
  }
  /* The ancients view. With an id it lists that name's lines; the drawing stays whole. */
  function goAncients(id) {
    state.view = 'ancients'; state.ideal = null; state.edge = null;
    var n = id && Array.isArray(ix.adj[id]) ? ix.byId[id] : null;
    state.selected = n && (/^(ideal|pattern|mechanism)$/.test(n.type) || ns.hasAncientLinks(ix, id)) ? id : null;
    setHash(state.selected ? '#ancients/' + state.selected : '#ancients');
    render();
  }
  function route() {
    var hash = location.hash.slice(1);
    if (hash === 'start') { goStart(); return; }
    if (hash === 'timeline') { goTimeline(); return; }
    if (hash === 'drawing') { idealsMode = 'drawing'; go(null); return; }
    if (hash.indexOf('r/') === 0 && hash.length > 2) { goRecord(hash.slice(2)); return; }
    if (hash === 'methods' && ns.hasMethods(ix)) { goMethods(); return; }
    if (hash.indexOf('door/') === 0) { goDoor(hash.slice(5)); return; }
    if (ns.hasPeople(ix) && (hash === 'people' || hash.indexOf('people/') === 0)) { goPeople(hash.slice(7) || null); return; }
    if (ns.hasWords(ix) && (hash === 'words' || hash.indexOf('words/') === 0)) { goWords(hash.slice(6) || null); return; }
    if (hash === 'ancients' || hash.indexOf('ancients/') === 0) { goAncients(hash.slice(9) || null); return; }
    if (hash === 'money' || hash.indexOf('money/') === 0) { goMoney(hash.slice(6) || null); return; }
    if (ns.hasWatch(ix) && (hash === 'watch' || hash.indexOf('watch/') === 0)) { goWatch(hash.slice(6) || null); return; }
    go(ix.byId[hash] && ix.byId[hash].type === 'ideal' ? hash : null);
  }
  function onNode(n) {
    hideTip();
    if (state.view === 'money') { if (n.id === state.selected) { state.edge = null; render(); } else goMoney(n.id); return; }
    if (state.view === 'ancients') { if (n.id === state.selected) { state.edge = null; render(); } else goAncients(n.id); return; }
    if (n.type === 'ideal') { if (n.id === state.ideal) { state.selected = null; state.edge = null; render(); } else go(n.id); return; }
    state.selected = n.id; state.edge = null; render();
  }
  function onEdge(e) { state.edge = e.i; render(); }

  function showTip(text, ev, anchor) {
    tip.textContent = text; tip.hidden = false;
    var box = stage.getBoundingClientRect(), x, y;
    if (ev) { x = ev.clientX - box.left + 14; y = ev.clientY - box.top + 14; }
    else { var r = anchor.getBoundingClientRect(); x = r.left - box.left + r.width / 2; y = r.bottom - box.top + 6; }
    tip.style.left = stage.scrollLeft + Math.max(4, Math.min(x, box.width - tip.offsetWidth - 4)) + 'px';
    tip.style.top = Math.max(4, Math.min(y, box.height - tip.offsetHeight - 4)) + 'px';
  }
  function hideTip() { tip.hidden = true; }

  function table(title, cols, rows) {
    var wrap = h('div', 'tbl'), t = h('table'), thead = h('thead'), tr = h('tr'), tb = h('tbody');
    add(wrap, h('h3', null, title + ' (' + rows.length + ')'));
    cols.forEach(function (c) { add(tr, h('th', null, c)); });
    add(thead, tr); add(t, thead);
    rows.forEach(function (r) {
      var row = h('tr');
      r.forEach(function (c) { var td = h('td'); if (c && c.nodeType) add(td, c); else td.textContent = c === undefined || c === null ? '' : c; add(row, td); });
      add(tb, row);
    });
    add(t, tb); add(wrap, t);
    return wrap;
  }
  var ANCIENT_LINK = { invokes: 'in their own words', reads_as: 'this project’s reading', uses: 'a recorded use', breaks_from: 'came out of' };
  function renderTables() {
    var box = document.getElementById('tables'), g = ix.g;
    add(box,
      table('Ideals', ['Ideal', 'Statement', 'Phases 0–5'], g.ideals.map(function (d) {
        return [d.label, d.ideal, ns.phaseSummary(d).map(function (s) { return ns.phaseWord[s]; }).join(' / ')]; })),
      table('Carriers', ['Name', 'Kind', 'Status', 'Note'], g.carriers.map(function (c) { return [c.label, c.kind, c.status, c.note]; })),
      table('Vehicles', ['Name', 'Note'], g.vehicles.map(function (v) { return [v.label, v.note]; })),
      table('Events', ['Date', 'What', 'Kind', 'Source', 'Checked'], g.fruits.map(function (f) {
        return [f.date, f.what, f.kind, link(f.url, f.source || 'source', f.nolink), VERIFIED[f.verified] || VERIFIED.unverified]; })),
      table('Texts', ['Reference', 'Tradition', 'Words', 'Translation'], g.texts.map(function (t) { return [t.ref, ns.tradition(t), t.quote, t.translation || 'King James Version']; })),
      table('Links', ['Sentence', 'Type', 'Lens'], g.edges.filter(function (e) { return !ns.isMoney(e) && !ANCIENT_LINK[e.type]; }).map(function (e) {
        return [e.sentence, e.type.replace(/_/g, ' '), e.lens ? 'yes' : '']; })));
    function nm0(id) { return ix.byId[id] ? (ix.byId[id].label || ix.byId[id].ref) : id; }
    if ((g.patterns || []).length || (g.offshoots || []).length) add(box,
      table('Ancient patterns', ['Pattern', 'What the tradition saw', 'Sources'], (g.patterns || []).map(function (p) {
        return [p.label, p.summary, (p.sources || []).map(function (s) { return s.work + (s.passage ? ' ' + s.passage : ''); })
          .concat((p.texts || []).map(function (t) { return ix.byId[t] ? ix.byId[t].ref + ' (' + ns.tradition(ix.byId[t]) + ')' : t; })).join('; ')]; })),
      table('Ancient links', ['From', 'Link', 'To', 'Words or reading', 'Where it stops', 'Source', 'Checked'],
        g.edges.filter(function (e) { return ANCIENT_LINK[e.type]; }).map(function (e) {
          return [nm0(e.from), ANCIENT_LINK[e.type], nm0(e.to), e.type === 'invokes' ? e.speaker + ': “' + e.quote + '” (' + e.sense + ')' : e.sentence,
            e.limit || '', e.source ? link(e.url, e.source, e.nolink) : '', e.verified ? (VERIFIED[e.verified] || '') : 'this project’s reading']; })),
      table('How it takes hold', ['Mechanism', 'Definition'], (g.mechanisms || []).map(function (m) { return [m.label, m.definition]; })),
      table('Offshoots', ['Name', 'Status', 'Why not an ideal'], (g.offshoots || []).map(function (o) { return [o.label, o.status, o.why_not]; })));
    var flows = g.edges.filter(ns.isMoney);
    if (!flows.length) return;
    function nm(id) { return ix.byId[id] ? (ix.byId[id].label || ix.byId[id].ref) : id; }
    add(box,
      table('Funders', ['Name', 'Kind', 'Note'], (g.funders || []).map(function (f) { return [f.label, f.kind, f.note]; })),
      table('AI companies', ['Name', 'Note'], (g.labs || []).map(function (f) { return [f.label, f.note]; })),
      table('Evaluators', ['Name', 'Note'], (g.evaluators || []).map(function (f) { return [f.label, f.note]; })),
      table('Money, hosting and evaluation', ['From', 'Link', 'To', 'Amount', 'Date', 'What the record says', 'Kind', 'Source', 'Checked'], flows.map(function (e) {
        return [nm(e.from), e.type, nm(e.to), e.amount, e.date, e.sentence, e.kind, e.source ? link(e.url, e.source, e.nolink) : '', VERIFIED[e.verified] || VERIFIED.unverified]; })));
  }

  function boot(g) {
    ix = ns.index(g);
    ix.reread = {};
    (g.reread || []).forEach(function (r) { ix.reread[r.url] = r; });
    svg = document.getElementById('map'); panel = document.getElementById('panel');
    tip = document.getElementById('tip'); stage = document.getElementById('stage');
    stage.addEventListener('scroll', pinMore, { passive: true });
    document.getElementById('to-overview').addEventListener('click', function () { go(null); });
    document.getElementById('theme').addEventListener('click', function () {
      var root = document.documentElement, cur = root.getAttribute('data-theme');
      var dark = cur ? cur === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', dark ? 'light' : 'dark');
    });
    document.getElementById('tab-ideals').addEventListener('click', function () { go(null); });
    /* A tab opens its view at the top, now that the tabs can be reached from far down a page. The views paint
       first (the buttons' own listeners run before this one), then the page goes to the top. */
    document.getElementById('views').addEventListener('click', function (ev) { if (ev.target.closest('button')) window.scrollTo(0, 0); });
    /* The title goes back to the front, as a reader expects of a site's name. */
    document.getElementById('home').addEventListener('click', function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;
      ev.preventDefault(); go(null); window.scrollTo(0, 0);
    });
    /* The bar (search and the parts of the map). On a wide screen it stays at the top while the page scrolls and
       draws a rule once it has left its place; on a narrow screen it is too tall to keep, so once it is out of
       sight a button brings it back. */
    (function () {
      var bar = document.getElementById('bar'), up = document.getElementById('to-top'), wide = window.matchMedia('(min-width: 901px)');
      function onScroll() {
        var r = bar.getBoundingClientRect();
        bar.classList.toggle('is-stuck', wide.matches && window.scrollY > 0 && r.top <= 0.5);
        up.hidden = wide.matches || r.bottom > -window.innerHeight;
      }
      up.addEventListener('click', function () {
        window.scrollTo(0, Math.max(0, bar.getBoundingClientRect().top + window.scrollY - 8));
        var t = document.querySelector('#views [aria-pressed="true"]') || document.getElementById('search');
        t.focus({ preventScroll: true });
      });
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      onScroll();
    })();
    document.getElementById('tab-money').addEventListener('click', function () { goMoney(null); });
    document.getElementById('tab-ancients').addEventListener('click', function () { goAncients(null); });
    document.getElementById('tab-ancients').hidden = !ns.hasAncients(ix);
    document.getElementById('tab-watch').addEventListener('click', function () { goWatch(null); });
    document.getElementById('tab-timeline').addEventListener('click', function () { goTimeline(); });
    document.getElementById('tab-timeline').hidden = !(g.fruits || []).length && !ns.hasWatch(ix);
    document.getElementById('to-start').addEventListener('click', function () { goStart(); });
    document.getElementById('tab-methods').hidden = !ns.hasMethods(ix);
    document.getElementById('tab-methods').addEventListener('click', function () { goMethods(); });
    document.getElementById('mode-cards').addEventListener('click', function () { idealsMode = 'cards'; go(null); });
    document.getElementById('mode-drawing').addEventListener('click', function () { idealsMode = 'drawing'; go(null); });
    /* The date the record last changed, from the build. */
    if (g.updated) {
      var up = document.getElementById('updated'); up.textContent = 'Updated ' + ns.longDate(g.updated); up.hidden = false;
      /* What's new: the cards view's newest claims and events. */
      var wn = h('button', 'linkbtn whats-new', 'What’s new'); wn.type = 'button';
      wn.addEventListener('click', function () {
        if (state.view !== 'cards') { idealsMode = 'cards'; go(null); }
        var el = document.getElementById('newest');
        if (el) { el.scrollIntoView({ block: 'start' }); el.focus({ preventScroll: true }); }
      });
      up.parentNode.insertBefore(wn, up.nextSibling);
      up.parentNode.insertBefore(document.createTextNode(' '), wn);
    }
    /* Said plainly while it is true: the map went out before a person had re-read its riskiest sources. */
    var s = g.sources || {}, dn = document.getElementById('draft-note'), m = g.meta || {};
    if (s.gate && s.gate_reread < s.gate) {
      /* One wording everywhere (here, the plain pages, Start here): "a person has re-read N of the M pages". */
      add(dn, h('span', 'dn-long', 'Published early, as a draft. AI models gathered and checked these records. A person re-reads the sources, ' +
        'the ' + s.gate + ' pages behind the Watch and the allegations first: ' + s.gate_reread + ' of ' + s.gate + ' re-read so far. Spot a mistake or a missing side? '),
        /* On a phone, away from the front, the same facts in one sentence. */
        h('span', 'dn-short', 'A draft, checked by AI models: a person has re-read ' + s.gate_reread + ' of the ' + s.gate +
          ' pages behind the Watch and the allegations so far. '));
      if (m.contribute) add(dn, link(m.contribute, 'Tell us'), h('span', null, '.'));
      else { var tb = h('button', 'linkbtn', 'See how to send it'); tb.type = 'button'; tb.addEventListener('click', goStart); add(dn, tb); }
      dn.hidden = false;
    }
    ns.initWho(ix, nav, ui);
    ns.initSearch(document.getElementById('search'), document.getElementById('search-hits'), ix, nav);
    document.getElementById('tab-watch').hidden = !ns.hasWatch(ix);
    document.getElementById('tab-money').hidden = !ix.g.edges.some(ns.isMoney);
    /* The offshoot mark is drawn only where an offshoot came out of a carrier. */
    var lo = document.querySelector('.legend-offshoot');
    if (lo) lo.hidden = !(ix.g.offshoots || []).some(function (o) {
      return ix.adj[o.id].some(function (l) { return l.edge.type === 'breaks_from' && ix.byId[l.other].type === 'carrier'; }); });
    /* Round the last tab that is shown, whichever it is. */
    var shown = [].slice.call(document.querySelectorAll('.views button')).filter(function (b) { return !b.hidden; });
    if (shown.length) shown[shown.length - 1].classList.add('last-visible');
    document.getElementById('views').hidden = !g.edges.some(ns.isMoney) && !ns.hasAncients(ix) && !ns.hasWatch(ix);
    window.addEventListener('hashchange', route);
    renderTables();
    route();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var inline = document.getElementById('graph-data');
    /* The single-file copy carries no plain pages, feed or data folder: their links go. */
    if (inline) { Array.prototype.forEach.call(document.querySelectorAll('.site-only'), function (e) { e.hidden = true; }); boot(JSON.parse(inline.textContent)); return; }
    fetch('graph.json').then(function (r) { return r.json(); }).then(boot).catch(function (err) {
      document.getElementById('panel').textContent = 'Could not load graph.json: ' + err.message;
    });
  });
})(window.IdealsMap = window.IdealsMap || {});
