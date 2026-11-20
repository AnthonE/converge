/* Who's who: a plain line on every public figure the map names, shown where the name appears (tap it) and on a
   page of its own. Words you'll meet: the same for a term a newcomer may not know (data/words.json). All text enters the DOM through textContent. */
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
  var IX = null, NAV = null, UI = null;

  ns.hasPeople = function (ix) { return (ix.g.people || []).length > 0; };

  function forms(ix) {
    if (ix.who) return ix.who;
    var list = [], by = {};
    (ix.g.people || []).forEach(function (p) {
      (p.match && p.match.length ? p.match : [p.name]).forEach(function (m) { list.push(m); by[m] = p; });
    });
    ix.who = { by: by, src: pattern(list), flags: '', cls: 'who', attr: 'data-who', key: function (m) { return m; },
      ask: function (name) { return name + ': who is this?'; } };
    return ix.who;
  }
  /* Words you'll meet: the same marking for a term a newcomer may not know. A form is matched in any letter case,
     except an acronym (EA, RL, PAC) and the forms of a word marked "case", which must match exactly. */
  var ACRONYM = /^[A-Z][A-Z0-9]{1,8}s?$/;
  ns.wordCase = function (w, m) { return !!w['case'] || ACRONYM.test(m); };
  function wordForms(ix) {
    if (ix.wordsAt) return ix.wordsAt;
    ix.wordsAt = [false, true].map(function (exact) {
      var list = [], by = {};
      (ix.g.words || []).forEach(function (w) {
        (w.match && w.match.length ? w.match : [w.word]).forEach(function (m) {
          if (ns.wordCase(w, m) !== exact) return;
          list.push(m); by[exact ? m : m.toLowerCase()] = w;
        });
      });
      return { by: by, src: pattern(list), flags: exact ? '' : 'i', cls: 'word', attr: 'data-word',
        key: exact ? function (m) { return m; } : function (m) { return m.toLowerCase(); },
        ask: function (word) { return word + ': what does it mean?'; } };
    }).filter(function (w) { return w.src; });
    return ix.wordsAt;
  }
  function pattern(list) {
    list.sort(function (a, b) { return b.length - a.length; });
    var esc = list.map(function (m) { return m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    return esc.length ? '(^|[^A-Za-z\\u00C0-\\u024F])(' + esc.join('|') + ')(?![A-Za-z\\u00C0-\\u024F])' : null;
  }

  var SKIP = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SCRIPT|STYLE|H1|H2|H3|H4|TIME|LABEL|OPTION)$/;
  var MARKED = ['who', 'who-card', 'word'];
  function annotateBlock(block, w, skip) {
    var test = new RegExp(w.src, w.flags), nodes = [], done = {};
    Object.keys(skip || {}).forEach(function (k) { done[k] = true; });
    var walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      var n = walker.currentNode, ok = test.test(n.nodeValue);
      for (var e = n.parentNode; ok && e && e !== block.parentNode; e = e.parentNode) {
        if (SKIP.test(e.tagName) || (e.classList && MARKED.some(function (c) { return e.classList.contains(c); }))) ok = false;
      }
      if (ok) nodes.push(n);
    }
    nodes.forEach(function (n) {
      var text = n.nodeValue, re = new RegExp(w.src, 'g' + w.flags), m, last = 0, frag = document.createDocumentFragment(), any = false;
      while ((m = re.exec(text))) {
        var name = m[2], p = w.by[w.key(name)], at = m.index + m[1].length;
        if (!p || done[p.id]) continue;
        done[p.id] = any = true;
        frag.appendChild(document.createTextNode(text.slice(last, at)));
        var b = document.createElement('button');
        b.type = 'button'; b.className = w.cls; b.textContent = name;
        b.setAttribute(w.attr, p.id); b.setAttribute('aria-haspopup', 'dialog');
        b.setAttribute('aria-label', w.ask(name));
        frag.appendChild(b);
        last = at + name.length;
      }
      if (!any) return;
      frag.appendChild(document.createTextNode(text.slice(last)));
      n.parentNode.replaceChild(frag, n);
    });
  }

  /* On a record's own page (here), a word that points to it and that its title already names is not marked: the
     page is the longer answer. Other words that point to it still are. */
  ns.wordsTitled = function (ix, here) {
    var n = here && (ix.byId[here] || (ns.methodById && ns.methodById(ix, here))), skip = {};
    if (!n) return skip;
    var title = String(n.label || n.ref || n.name || n.title || '').toLowerCase();
    (ix.g.words || []).forEach(function (w) {
      if (w.see === here && (w.match && w.match.length ? w.match : [w.word]).some(function (m) { return title.indexOf(m.toLowerCase()) >= 0; })) skip[w.id] = true;
    });
    return skip;
  };
  /* Mark the first mention of each person, and of each word, in each block (a panel, a Watch entry, a timeline item). */
  ns.annotate = function (root, ix, blockSelector, here) {
    if (!root) return;
    var sets = [];
    if (ns.hasPeople(ix) && forms(ix).src) sets.push(forms(ix));
    if (ns.hasWords(ix)) wordForms(ix).forEach(function (w) { sets.push(w); });
    if (!sets.length) return;
    var blocks = blockSelector ? root.querySelectorAll(blockSelector) : [root];
    var skip = here ? ns.wordsTitled(ix, here) : null;
    [].forEach.call(blocks, function (b) { sets.forEach(function (w) { annotateBlock(b, w, w.cls === 'word' ? skip : null); }); });
  };
  ns.hasWords = function (ix) { return (ix.g.words || []).length > 0; };

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
    var o = document.createElement('button'); o.type = 'button'; o.className = 'linkbtn'; o.textContent = 'Everything about ' + p.name;
    o.addEventListener('click', function () { c.hidden = true; NAV.goRecord(p.id); });
    row.appendChild(o);
    var all = document.createElement('button'); all.type = 'button'; all.className = 'linkbtn'; all.textContent = "Everyone in who's who";
    all.addEventListener('click', function () { c.hidden = true; NAV.goPeople(p.id); });
    row.appendChild(all);
    c.appendChild(row);
    c.setAttribute('aria-label', 'Who is ' + p.name);
  }
  /* A word's card: its plain meaning, the coiner's own words where the map has them, where the meaning was read,
     and the way to the record that goes deeper. */
  var FLAG = { primary: 'checked at the source', secondary: 'checked on a relay', unverified: 'not checked' };
  var VIEW_NAME = { methods: 'The alignment methods, side by side', money: 'Money and evaluators', ancients: 'The ancients',
    watch: 'The Watch', timeline: 'Timeline', ideals: 'The ideals', people: 'Who’s who', start: 'Start here' };
  function wordById(id) { return (IX.g.words || []).filter(function (w) { return w.id === id; })[0]; }
  function seeName(w) {
    var n = w.see && (IX.byId[w.see] || (ns.methodById && ns.methodById(IX, w.see)));
    return n ? (n.label || n.ref || n.name || n.title || n.id) : '';
  }
  function anchor(url, text, nolink) {
    if (!url || nolink) return document.createTextNode(text);
    var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = text;
    return a;
  }
  /* The parts a word shows wherever it is shown: on its card and on the list of words. */
  ns.wordParts = function (ix, ui, w) {
    var out = [];
    var t = document.createElement('p'); t.className = 'who-line'; t.textContent = w.plain; out.push(t);
    if (w.said) {
      var q = document.createElement('p'); q.className = 'word-said';
      var qq = document.createElement('q'); qq.textContent = w.said.quote;
      q.appendChild(qq);
      q.appendChild(document.createTextNode(' — ' + w.said.speaker + ', '));
      q.appendChild(anchor(w.said.url, w.said.source, w.said.nolink));
      q.appendChild(document.createTextNode(' '));
      q.appendChild(ui && ui.badge ? ui.badge(w.said.verified, w.said.url) : document.createTextNode('(' + (FLAG[w.said.verified] || FLAG.unverified) + ')'));
      out.push(q);
    }
    if (w.url) {
      var s = document.createElement('p'); s.className = 'who-src';
      s.appendChild(document.createTextNode('Meaning as given by '));
      s.appendChild(anchor(w.url, w.source || 'source', w.nolink));
      s.appendChild(document.createTextNode(' '));
      s.appendChild(ui && ui.badge ? ui.badge(w.verified, w.url) : document.createTextNode('(' + (FLAG[w.verified] || FLAG.unverified) + ')'));
      out.push(s);
    }
    return out;
  };
  function fillWord(c, w) {
    while (c.firstChild) c.removeChild(c.firstChild);
    var h = document.createElement('p'); h.className = 'who-name'; h.textContent = w.word;
    c.appendChild(h);
    ns.wordParts(IX, UI, w).forEach(function (x) { c.appendChild(x); });
    var n = document.createElement('p'); n.className = 'who-src';
    n.textContent = 'A plain note from this map. The people quoted may use the word in their own way.';
    c.appendChild(n);
    var row = document.createElement('p'); row.className = 'who-actions';
    var name = seeName(w);
    if (name) {
      var o = document.createElement('button'); o.type = 'button'; o.className = 'linkbtn'; o.textContent = 'Read more: ' + name;
      o.addEventListener('click', function () { c.hidden = true; NAV.goRecord(w.see); });
      row.appendChild(o);
    }
    if (w.view && VIEW_NAME[w.view]) {
      var v = document.createElement('button'); v.type = 'button'; v.className = 'linkbtn'; v.textContent = VIEW_NAME[w.view];
      v.addEventListener('click', function () { c.hidden = true; NAV.goView(w.view); });
      row.appendChild(v);
    }
    var all = document.createElement('button'); all.type = 'button'; all.className = 'linkbtn'; all.textContent = 'All the words';
    all.addEventListener('click', function () { c.hidden = true; NAV.goWords(w.id); });
    row.appendChild(all);
    c.appendChild(row);
    c.setAttribute('aria-label', 'What ' + w.word + ' means');
  }
  function show(btn) {
    var c = card(), id;
    if ((id = btn.getAttribute('data-word'))) {
      var w = wordById(id);
      if (!w) return;
      fillWord(c, w);
    } else {
      var p = personById(btn.getAttribute('data-who'));
      if (!p) return;
      fill(c, p);
    }
    c.hidden = false;
    var r = btn.getBoundingClientRect(), wd = Math.min(340, document.documentElement.clientWidth - 24);
    c.style.width = wd + 'px';
    c.style.left = Math.max(12, Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - wd - 12)) + 'px';
    c.style.top = (r.bottom + window.scrollY + 6) + 'px';
    c.setAttribute('tabindex', '-1');
    c.focus({ preventScroll: true });
    card.from = btn;
  }

  ns.initWho = function (ix, nav, ui) {
    IX = ix; NAV = nav; UI = ui;
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('.who, .word') : null, c = card();
      if (b) { ev.preventDefault(); if (!c.hidden && card.from === b) c.hidden = true; else show(b); return; }
      if (!c.hidden && !c.contains(ev.target)) c.hidden = true;
    });
    document.addEventListener('keydown', function (ev) {
      var c = card();
      if (ev.key === 'Escape' && !c.hidden) { c.hidden = true; if (card.from) card.from.focus(); }
    });
  };

  /* Words you'll meet: every word, in the guide's sections, each in one or two plain sentences, with where to read more. */
  var WORD_GROUPS = [
    ['ai', 'How AI is built, run and tested'],
    ['safety', 'Risk, safety and control'],
    ['movements', 'Movements, factions and their slang'],
    ['life', 'Death, longevity and made companions'],
    ['money', 'Money, crypto, politics and law'],
    ['orgs', 'Acronyms and organisations'],
    ['old', 'Old words: scripture, myth and the occult']
  ];
  function sortKey(w) { return w.word.toLowerCase().replace(/^the /, ''); }
  ns.renderWords = function (box, ix, ui, nav, focusId) {
    while (box.firstChild) box.removeChild(box.firstChild);
    var all = ix.g.words || [];
    var intro = ui.h('div', 'watch-intro');
    ui.add(intro, ui.h('h2', null, 'Words you\u2019ll meet'),
      ui.h('p', null, 'An insider\u2019s guide: ' + all.length + ' words the people on this map use that a newcomer may not know, each in one or two plain sentences, with where to read more. Tap an underlined word anywhere on the map to see the same note.'),
      ui.h('p', 'note', 'The notes are this map\u2019s plain wording; the people quoted may use a word in their own way. Where a note gives someone\u2019s own definition, it is a quotation already on the map, with its source and how it was checked.'));
    ui.add(box, intro);
    /* Find a word: the list narrows as you type; nothing leaves the page. */
    var find = ui.h('input', 'word-find'); find.type = 'search'; find.placeholder = 'Find a word'; find.setAttribute('aria-label', 'Find a word in the guide');
    var jump = ui.h('nav', 'word-jump'); jump.setAttribute('aria-label', 'Sections of the guide');
    ui.add(box, find, jump);
    var none = ui.h('p', 'note', 'No word in the guide matches that.'); none.hidden = true;
    var secs = [];
    WORD_GROUPS.forEach(function (g) {
      var words = all.filter(function (w) { return w.group === g[0]; }).sort(function (a, b) { return sortKey(a).localeCompare(sortKey(b)); });
      if (!words.length) return;
      var sec = ui.section(g[1] + ' (' + words.length + ')'), dl = ui.h('dl', 'glossary words');
      sec.id = 'words-' + g[0];
      var j = ui.h('button', 'linkbtn', g[1]); j.type = 'button';
      j.addEventListener('click', function () { sec.scrollIntoView(); });
      ui.add(jump, j);
      secs.push(sec);
      fillWords(ix, ui, nav, dl, words);
      ui.add(box, ui.add(sec, dl));
    });
    ui.add(box, none);
    find.addEventListener('input', function () {
      var q = find.value.trim().toLowerCase(), shown = 0;
      secs.forEach(function (sec) {
        var any = false;
        [].forEach.call(sec.querySelectorAll('dt'), function (dt) {
          var dd = dt.nextElementSibling, hit = !q || (dt.textContent + ' ' + dt.getAttribute('data-forms') + ' ' + dd.textContent).toLowerCase().indexOf(q) >= 0;
          dt.hidden = dd.hidden = !hit; if (hit) { any = true; shown++; }
        });
        sec.hidden = !any;
      });
      jump.hidden = !!q; none.hidden = shown > 0;
    });
    var target = focusId && document.getElementById('word-' + focusId);
    if (target) { target.setAttribute('tabindex', '-1'); target.scrollIntoView(); target.focus(); }
  };
  function fillWords(ix, ui, nav, dl, words) {
    words.forEach(function (w) {
      var dt = ui.h('dt', null, w.word); dt.id = 'word-' + w.id; dt.setAttribute('data-forms', (w.match || []).join(' '));
      var dd = ui.h('dd');
      ns.wordParts(ix, ui, w).forEach(function (x) { ui.add(dd, x); });
      var row = ui.h('p', 'word-more'), name = w.see && (ix.byId[w.see] || (ns.methodById && ns.methodById(ix, w.see)));
      if (name) {
        var b = ui.h('button', 'linkbtn', 'Read more: ' + (name.label || name.ref || name.name || name.id)); b.type = 'button';
        b.addEventListener('click', function () { nav.goRecord(w.see); });
        ui.add(row, b);
      }
      if (w.view && VIEW_NAME[w.view]) {
        var v = ui.h('button', 'linkbtn', VIEW_NAME[w.view]); v.type = 'button';
        v.addEventListener('click', function () { nav.goView(w.view); });
        ui.add(row, v);
      }
      if (row.children.length) ui.add(dd, row);
      ui.add(dl, dt, dd);
    });
  }

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
        var b = ui.h('button', 'linkbtn', p.name); b.type = 'button';
        b.addEventListener('click', function () { nav.goRecord(p.id); });
        ui.add(dt, b);
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
