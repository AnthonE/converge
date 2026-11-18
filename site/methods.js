/* Alignment methods, side by side, each with the same five questions answered; and the doors, a way in for each
   viewpoint. All text enters the DOM through textContent. */
(function (ns) {
  'use strict';

  var KEY = [
    ['serves', 'Whom does the model serve?'],
    ['values', 'Who writes down what it should value?'],
    ['inside', 'Does it rely on seeing inside the model?'],
    ['checks', 'Who checks it worked, and are they independent of the builder?'],
    ['fails', 'What happens if it fails?']
  ];
  ns.methodKey = KEY;
  ns.hasMethods = function (ix) { return (ix.g.methods || []).length > 0; };
  ns.methodById = function (ix, id) { return (ix.g.methods || []).filter(function (m) { return m.id === id; })[0]; };
  /* Methods a name on the map pushes or uses, by the method records. */
  ns.methodsPushedBy = function (ix, id) {
    return (ix.g.methods || []).filter(function (m) { return (m.pushed_by || []).some(function (p) { return p.node === id; }); });
  };

  function answer(ui, x) {
    var d = ui.h('div', 'mk-answer');
    ui.add(d, ui.h('span', null, x.a + ' '));
    if (x.kind === 'own words') ui.add(d, ui.add(ui.h('span', 'mk-src'), ui.h('span', null, '“' + x.quote + '” — ' + x.speaker + ', '), ui.link(x.url, x.source, x.nolink), ui.h('span', null, ' '), ui.badge(x.verified, x.url)));
    else ui.add(d, ui.h('span', 'lane', 'this project’s reading'));
    return d;
  }

  /* The comparison: one row per method, one column per question. On a phone each row stacks into a card. */
  ns.renderMethods = function (box, ix, ui, nav) {
    while (box.firstChild) box.removeChild(box.firstChild);
    var intro = ui.h('div', 'watch-intro');
    ui.add(intro, ui.h('h2', null, 'Alignment methods, side by side'),
      ui.h('p', null, 'The ways people propose to make AI do what it should. Each is asked the same five questions, so you can see what it takes for granted. When someone is pushing a method, these are the beliefs that come with it.'),
      ui.h('p', 'note', 'Answers in quotation marks are the method’s proponents’ own words, with the source. The rest are this project’s reading, marked as such. Nothing here ranks the methods.'));
    ui.add(box, intro);
    var wrap = ui.h('div', 'mk-wrap'), t = ui.h('table', 'mk-table'), thead = ui.h('thead'), hr = ui.h('tr');
    ui.add(hr, ui.h('th', null, 'Method'));
    KEY.forEach(function (k) { ui.add(hr, ui.h('th', null, k[1])); });
    ui.add(thead, hr); ui.add(t, thead);
    var tb = ui.h('tbody');
    (ix.g.methods || []).forEach(function (m) {
      var tr = ui.h('tr'), th = ui.h('th', 'mk-name');
      th.setAttribute('scope', 'row');
      var b = ui.h('button', 'linkbtn', m.label); b.type = 'button';
      b.addEventListener('click', function () { nav.goRecord(m.id); });
      ui.add(th, b, ui.h('p', 'mk-plain', m.plain));
      ui.add(tr, th);
      KEY.forEach(function (k) {
        var x = (m.key || []).filter(function (y) { return y.q === k[0]; })[0];
        var td = ui.h('td'); td.setAttribute('data-q', k[1]);
        if (x) ui.add(td, ui.h('span', null, x.a), x.kind === 'own words' ? ui.h('span', 'mk-mark', ' “”') : null);
        ui.add(tr, td);
      });
      ui.add(tb, tr);
    });
    ui.add(t, tb); ui.add(wrap, t); ui.add(box, wrap);
    ui.add(box, ui.h('p', 'note', 'A “” after an answer means the method’s own words back it; open the method to read them.'));
  };

  /* A method's own record. */
  ns.renderMethodRecord = function (box, ix, ui, nav, m, trail) {
    var head = ui.h('header', 'rec-head');
    ui.add(head, ui.h('p', 'kicker', 'Alignment method'), ui.h('h2', 'rec-title', m.label), ui.h('p', 'rec-lede', m.plain), trail);
    var acts = ui.h('p', 'rec-actions'), all = ui.h('button', 'linkbtn', 'All methods side by side'); all.type = 'button';
    all.addEventListener('click', function () { nav.goMethods(); });
    ui.add(head, ui.add(acts, all));
    ui.add(box, head);
    if (m.bet) ui.add(box, ui.add(ui.section('What it bets on', 'In its proponents’ own words.'), ui.quoteList([m.bet])));
    var ks = ui.section('The five questions', 'The same five, asked of every method.'), dl = ui.h('dl', 'glossary mk-key');
    KEY.forEach(function (k) {
      var x = (m.key || []).filter(function (y) { return y.q === k[0]; })[0];
      if (!x) return;
      ui.add(dl, ui.h('dt', null, k[1]), ui.add(ui.h('dd'), answer(ui, x)));
    });
    ui.add(box, ui.add(ks, dl));
    if ((m.pushed_by || []).length) {
      var ps = ui.section('Who pushes it'), ul = ui.h('ul', 'links rec-list');
      m.pushed_by.forEach(function (p) {
        var li = ui.h('li');
        if (p.node && ix.byId[p.node]) { var b = ui.h('button', 'linkbtn', p.name); b.type = 'button'; b.addEventListener('click', function () { nav.goRecord(p.node); }); ui.add(li, b); }
        else ui.add(li, ui.h('b', null, p.name));
        ui.add(li, ui.h('span', null, ': ' + p.how + ' '), p.url ? ui.link(p.url, p.source || 'source', p.nolink) : null, ui.h('span', null, ' '), p.verified ? ui.badge(p.verified, p.url) : null);
        ui.add(ul, li);
      });
      ui.add(box, ui.add(ps, ul));
    }
    if ((m.pushback || []).length) ui.add(box, ui.add(ui.section('The pushback', 'Critics in their own words.'), ui.quoteList(m.pushback)));
    if ((m.happened || []).length) {
      var hs = ui.section('What has happened'), hl = ui.h('ul', 'links rec-list');
      m.happened.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).forEach(function (f) {
        ui.add(hl, ui.add(ui.h('li'), ui.h('span', 'rec-date', f.date + ' '), ui.h('span', null, f.what + ' '), ui.h('span', 'lane', f.kind), ui.h('span', null, ' '), ui.link(f.url, f.source, f.nolink), ui.h('span', null, ' '), ui.badge(f.verified, f.url)));
      });
      ui.add(box, ui.add(hs, hl));
    }
    if ((m.cautions || []).length) {
      var cs = ui.section('Read with care'), cl = ui.h('ul');
      m.cautions.forEach(function (c) { ui.add(cl, ui.h('li', null, c)); });
      ui.add(box, ui.add(cs, cl));
    }
  };

  /* Doors: where are you coming from? */
  ns.hasDoors = function (ix) { return (ix.g.doors || []).length > 0; };
  ns.renderDoorStrip = function (el, ix, ui, nav) {
    while (el.firstChild) el.removeChild(el.firstChild);
    if (!ns.hasDoors(ix)) { el.hidden = true; return; }
    ui.add(el, ui.h('span', 'doors-q', 'Where are you coming from?'));
    (ix.g.doors || []).forEach(function (d) {
      var b = ui.h('button', 'door-chip', d.label); b.type = 'button';
      b.addEventListener('click', function () { nav.goDoor(d.id); });
      ui.add(el, b);
    });
  };
  ns.renderDoor = function (box, ix, ui, nav, id) {
    while (box.firstChild) box.removeChild(box.firstChild);
    var d = (ix.g.doors || []).filter(function (x) { return x.id === id; })[0];
    if (!d) { ui.add(box, ui.h('p', null, 'No door has that address.')); return; }
    var intro = ui.h('div', 'watch-intro');
    ui.add(intro, ui.h('p', 'kicker', 'A way in'), ui.h('h2', null, d.label), ui.h('p', 'lede', d.lede));
    ui.add(box, intro);
    var ol = ui.h('ol', 'door-stops');
    (d.stops || []).forEach(function (s) {
      var li = ui.h('li'), title, go;
      if (s.record) {
        var n = ix.byId[s.record], p = (ix.g.people || []).filter(function (x) { return x.id === s.record; })[0];
        var m = ns.methodById(ix, s.record), w = (ix.g.watch || []).filter(function (x) { return x.id === s.record; })[0];
        title = n ? (n.label || n.ref) : p ? p.name : m ? m.label : w ? w.title : s.record;
        go = w ? function () { nav.goWatch(s.record); } : function () { nav.goRecord(s.record); };
      } else {
        title = s.title || s.view;
        go = function () { nav.goView(s.view); };
      }
      var b = ui.h('button', 'linkbtn door-go', title); b.type = 'button'; b.addEventListener('click', go);
      ui.add(li, b, ui.h('p', 'door-why', s.why));
      ui.add(ol, li);
    });
    ui.add(box, ol);
    var other = ui.h('p', 'note'), more = ui.h('span', null, 'Other ways in: ');
    ui.add(other, more);
    (ix.g.doors || []).filter(function (x) { return x.id !== id; }).forEach(function (x, i) {
      var b = ui.h('button', 'linkbtn', x.label); b.type = 'button'; b.addEventListener('click', function () { nav.goDoor(x.id); });
      ui.add(other, i ? ui.h('span', null, ' · ') : null, b);
    });
    ui.add(box, other);
  };
})(window.IdealsMap = window.IdealsMap || {});
