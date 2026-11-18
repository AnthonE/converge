/* Who's who: a plain line on every public figure the map names, shown where the name appears (tap it) and on a
   page of its own. All text enters the DOM through textContent. */
(function (ns) {
  'use strict';

  var GROUPS = [
    ['builders', 'Builders, founders and investors'],
    ['thinkers', 'Writers, thinkers and researchers'],
    ['faith', 'Religious leaders and teachers'],
    ['press', 'Reporters and commentators'],
    ['officials', 'Officials'],
    ['past', 'Writers of the past']
  ];
  var IX = null, NAV = null;

  ns.hasPeople = function (ix) { return (ix.g.people || []).length > 0; };

  function forms(ix) {
    if (ix.who) return ix.who;
    var list = [], by = {};
    (ix.g.people || []).forEach(function (p) {
      (p.match && p.match.length ? p.match : [p.name]).forEach(function (m) { list.push(m); by[m] = p; });
    });
    list.sort(function (a, b) { return b.length - a.length; });
    var esc = list.map(function (m) { return m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    ix.who = { by: by, src: esc.length ? '(^|[^A-Za-z\\u00C0-\\u024F])(' + esc.join('|') + ')(?![A-Za-z\\u00C0-\\u024F])' : null };
    return ix.who;
  }

  var SKIP = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SCRIPT|STYLE|H1|H2|H3|TIME|LABEL|OPTION)$/;
  function annotateBlock(block, w) {
    var test = new RegExp(w.src), nodes = [], done = {};
    var walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      var n = walker.currentNode, ok = test.test(n.nodeValue);
      for (var e = n.parentNode; ok && e && e !== block.parentNode; e = e.parentNode) {
        if (SKIP.test(e.tagName) || (e.classList && (e.classList.contains('who') || e.classList.contains('who-card')))) ok = false;
      }
      if (ok) nodes.push(n);
    }
    nodes.forEach(function (n) {
      var text = n.nodeValue, re = new RegExp(w.src, 'g'), m, last = 0, frag = document.createDocumentFragment(), any = false;
      while ((m = re.exec(text))) {
        var name = m[2], p = w.by[name], at = m.index + m[1].length;
        if (!p || done[p.id]) continue;
        done[p.id] = any = true;
        frag.appendChild(document.createTextNode(text.slice(last, at)));
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'who'; b.textContent = name;
        b.setAttribute('data-who', p.id); b.setAttribute('aria-haspopup', 'dialog');
        b.setAttribute('aria-label', name + ': who is this?');
        frag.appendChild(b);
        last = at + name.length;
      }
      if (!any) return;
      frag.appendChild(document.createTextNode(text.slice(last)));
      n.parentNode.replaceChild(frag, n);
    });
  }

  /* Mark the first mention of each person in each block (a panel, a Watch entry, a timeline item). */
  ns.annotate = function (root, ix, blockSelector) {
    if (!root || !ns.hasPeople(ix)) return;
    var w = forms(ix);
    if (!w.src) return;
    var blocks = blockSelector ? root.querySelectorAll(blockSelector) : [root];
    [].forEach.call(blocks, function (b) { annotateBlock(b, w); });
  };

  function personById(id) { return (IX.g.people || []).filter(function (p) { return p.id === id; })[0]; }

  function card() {
    var c = document.getElementById('who-card');
    if (!c) {
      c = document.createElement('div');
      c.id = 'who-card'; c.className = 'who-card'; c.setAttribute('role', 'dialog'); c.hidden = true;
      (document.querySelector('.viz-root') || document.body).appendChild(c);
    }
    return c;
  }
  function fill(c, p) {
    while (c.firstChild) c.removeChild(c.firstChild);
    var h = document.createElement('p'); h.className = 'who-name'; h.textContent = p.name;
    var t = document.createElement('p'); t.className = 'who-line'; t.textContent = p.who;
    var s = document.createElement('p'); s.className = 'who-src';
    if (p.url && !p.nolink) { var a = document.createElement('a'); a.href = p.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = p.source || 'source'; s.appendChild(a); }
    else s.textContent = p.source || '';
    c.appendChild(h); c.appendChild(t); c.appendChild(s);
    var row = document.createElement('p'); row.className = 'who-actions';
    if (p.node && IX.byId[p.node]) {
      var o = document.createElement('button'); o.type = 'button'; o.className = 'linkbtn'; o.textContent = 'Open on the map';
      o.addEventListener('click', function () { c.hidden = true; NAV.openNode(p.node); });
      row.appendChild(o);
    }
    var all = document.createElement('button'); all.type = 'button'; all.className = 'linkbtn'; all.textContent = "Everyone in who's who";
    all.addEventListener('click', function () { c.hidden = true; NAV.goPeople(p.id); });
    row.appendChild(all);
    c.appendChild(row);
    c.setAttribute('aria-label', 'Who is ' + p.name);
  }
  function show(btn) {
    var p = personById(btn.getAttribute('data-who')), c = card();
    if (!p) return;
    fill(c, p);
    c.hidden = false;
    var r = btn.getBoundingClientRect(), w = Math.min(340, document.documentElement.clientWidth - 24);
    c.style.width = w + 'px';
    c.style.left = Math.max(12, Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - w - 12)) + 'px';
    c.style.top = (r.bottom + window.scrollY + 6) + 'px';
    c.setAttribute('tabindex', '-1');
    c.focus({ preventScroll: true });
    card.from = btn;
  }

  ns.initWho = function (ix, nav) {
    IX = ix; NAV = nav;
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('.who') : null, c = card();
      if (b) { ev.preventDefault(); if (!c.hidden && card.from === b) c.hidden = true; else show(b); return; }
      if (!c.hidden && !c.contains(ev.target)) c.hidden = true;
    });
    document.addEventListener('keydown', function (ev) {
      var c = card();
      if (ev.key === 'Escape' && !c.hidden) { c.hidden = true; if (card.from) card.from.focus(); }
    });
  };

  /* The whole list, grouped. */
  ns.renderPeople = function (box, ix, ui, nav, focusId) {
    while (box.firstChild) box.removeChild(box.firstChild);
    var intro = ui.h('div', 'watch-intro');
    ui.add(intro, ui.h('h2', null, 'Who’s who'),
      ui.h('p', null, 'The public figures this map names, each in one plain sentence: who they are and why they come up. Tap a name anywhere on the map to see the same note.'),
      ui.h('p', 'note', 'Each note links to where it was checked. People who are not public figures are never named on this map, so they are not here.'));
    ui.add(box, intro);
    var people = (ix.g.people || []).slice().sort(function (a, b) { return a.sort.localeCompare(b.sort); });
    GROUPS.forEach(function (g) {
      var mine = people.filter(function (p) { return p.group === g[0]; });
      if (!mine.length) return;
      var sec = ui.section(g[1] + ' (' + mine.length + ')'), dl = ui.h('dl', 'glossary people');
      mine.forEach(function (p) {
        var dt = ui.h('dt'); dt.id = 'who-' + p.id;
        if (p.node && ix.byId[p.node]) {
          var b = ui.h('button', 'linkbtn', p.name); b.type = 'button';
          b.addEventListener('click', function () { nav.openNode(p.node); });
          ui.add(dt, b);
        } else dt.textContent = p.name;
        var dd = ui.h('dd');
        ui.add(dd, ui.h('span', null, p.who + ' '), ui.link(p.url, p.source || 'source', p.nolink), ui.h('span', null, ' '), ui.badge(p.verified, p.url));
        ui.add(dl, dt, dd);
      });
      ui.add(box, ui.add(sec, dl));
    });
    var target = focusId && document.getElementById('who-' + focusId);
    if (target) { target.setAttribute('tabindex', '-1'); target.scrollIntoView(); target.focus(); }
  };
})(window.IdealsMap = window.IdealsMap || {});
