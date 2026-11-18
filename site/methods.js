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

  /* Money behind a method: the records of money into the bodies on the map that push it. A funder of a pusher is
     not thereby a backer of the method; allegations are left out, as on the money view. */
  var MONEY_KIND = [
    ['investment', 'Investment', 'a stake, share purchase or loan'],
    ['grant', 'Grants and gifts', 'a grant, donation or pledge to give'],
    ['government', 'Public money', 'given or appropriated by a state body'],
    ['commission', 'Paid work', 'a contract or commissioned work'],
    ['political', 'Political money', 'to or between political groups']
  ];
  ns.moneyKinds = MONEY_KIND;
  ns.moneyWord = function (k) { var r = MONEY_KIND.filter(function (x) { return x[0] === k; })[0]; return r ? r[1] : k; };
  ns.moneyBehind = function (ix, m) {
    var seen = {}, out = [], missing = [];
    (m.pushed_by || []).forEach(function (p) {
      if (!p.node || !ix.byId[p.node]) { if (missing.indexOf(p.name) < 0) missing.push(p.name); return; }
      if (seen[p.node]) return;
      seen[p.node] = true;
      var flows = (ix.adj[p.node] || []).filter(function (l) {
        return l.edge.type === 'funds' && l.edge.to === p.node && l.edge.kind !== 'alleged' && ix.byId[l.edge.from];
      }).map(function (l) { return l.edge; });
      out.push({ node: ix.byId[p.node], flows: flows });
    });
    return { pushers: out, missing: missing };
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
    renderMoneyTable(box, ix, ui, nav);
  };

  /* Who pays for the bodies that push each method, by kind of money. */
  function renderMoneyTable(box, ix, ui, nav) {
    var rows = (ix.g.methods || []).map(function (m) { return { m: m, mb: ns.moneyBehind(ix, m) }; });
    var used = MONEY_KIND.filter(function (k) {
      return rows.some(function (r) { return r.mb.pushers.some(function (p) { return p.flows.some(function (e) { return e.money === k[0]; }); }); });
    });
    if (!used.length) return;
    var intro = ui.h('div', 'watch-intro mk-money-intro');
    ui.add(intro, ui.h('h2', null, 'Who pays for the bodies that push each method'),
      ui.h('p', null, 'For each method, the companies and groups on this map that push it, and the money on record flowing into them, sorted by kind of money. Open a name for the amounts, dates and sources.'),
      ui.h('p', 'note', 'Paying a body that pushes a method does not make the payer a backer of that method, and most of these bodies do other work too. A name appears once per column however many payments are on file. An empty cell means no record was found here, not that no money exists. Allegations are not counted.'));
    ui.add(box, intro);
    var wrap = ui.h('div', 'mk-wrap'), t = ui.h('table', 'mk-table mk-money'), thead = ui.h('thead'), hr = ui.h('tr');
    ui.add(hr, ui.h('th', null, 'Method'), ui.h('th', null, 'Pushed by (on the map)'));
    used.forEach(function (k) { ui.add(hr, ui.h('th', null, k[1])); });
    ui.add(thead, hr); ui.add(t, thead);
    var tb = ui.h('tbody');
    rows.forEach(function (r) {
      var tr = ui.h('tr'), th = ui.h('th', 'mk-name');
      th.setAttribute('scope', 'row');
      var b = ui.h('button', 'linkbtn', r.m.label); b.type = 'button';
      b.addEventListener('click', function () { nav.goRecord(r.m.id); });
      ui.add(tr, ui.add(th, b));
      var pt = ui.h('td'); pt.setAttribute('data-q', 'Pushed by (on the map)');
      nameList(ui, nav, pt, r.mb.pushers.map(function (p) { return p.node; }));
      if (!r.mb.pushers.length) ui.add(pt, ui.h('span', 'note', 'none on the map'));
      ui.add(tr, pt);
      used.forEach(function (k) {
        var td = ui.h('td'), names = {}, list = [];
        td.setAttribute('data-q', k[1]);
        r.mb.pushers.forEach(function (p) {
          p.flows.forEach(function (e) { if (e.money === k[0] && !names[e.from]) { names[e.from] = true; list.push(ix.byId[e.from]); } });
        });
        list.sort(function (a, c) { return (a.label || '').localeCompare(c.label || ''); });
        nameList(ui, nav, td, list);
        if (!list.length) ui.add(td, ui.h('span', 'mk-none', '—'));
        ui.add(tr, td);
      });
      ui.add(tb, tr);
    });
    ui.add(t, tb); ui.add(wrap, t); ui.add(box, wrap);
  }
  /* One name per line, so a long name never strands a separator. */
  function nameList(ui, nav, el, nodes) {
    nodes.forEach(function (n) { ui.add(el, ui.add(ui.h('span', 'mk-item'), nameButton(ui, nav, n))); });
  }
  function nameButton(ui, nav, n) {
    var b = ui.h('button', 'linkbtn', n.label || n.ref); b.type = 'button';
    b.addEventListener('click', function () { nav.goRecord(n.id); });
    return b;
  }

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
    var mb = ns.moneyBehind(ix, m);
    if (mb.pushers.length) {
      var ms = ui.section('Money behind those who push it', 'Records of money into the bodies above. Paying a body that pushes a method does not make the payer a backer of the method. Allegations are left out.');
      mb.pushers.forEach(function (p) {
        ui.add(ms, ui.add(ui.h('h4', 'mk-payee'), nameButton(ui, nav, p.node)));
        if (!p.flows.length) { ui.add(ms, ui.h('p', 'note', 'No record of money into it was found here.')); return; }
        var ul = ui.h('ul', 'links rec-list');
        p.flows.slice().sort(function (a, c) { return String(c.date || '').localeCompare(String(a.date || '')); }).forEach(function (e) {
          var li = ui.h('li');
          ui.add(li, nameButton(ui, nav, ix.byId[e.from]), ui.h('span', 'lane', ' ' + ns.moneyWord(e.money) + ' '),
            ui.h('span', null, (e.amount ? e.amount : 'amount not stated') + (e.date ? ', ' + e.date : '') + '. '),
            e.url ? ui.link(e.url, e.source || 'source', e.nolink) : null, ui.h('span', null, ' '), e.verified ? ui.badge(e.verified, e.url) : null);
          ui.add(ul, li);
        });
        ui.add(ms, ul);
      });
      if (mb.missing.length) ui.add(ms, ui.h('p', 'note', 'Not on the map, so no money is on file for: ' + mb.missing.join('; ') + '.'));
      ui.add(box, ms);
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
