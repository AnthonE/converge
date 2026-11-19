/* The record: one page shape for everything on the map (an ideal, a person, a group, an event, a pattern, a money
   record). What it says, who says it, what happened, who pays, what the old texts called it, the other side, what is
   open, every thread to the rest, and its trail: drafted, machine-checked, re-read by a person.
   All text enters the DOM through textContent. */
(function (ns) {
  'use strict';

  var PHASE = { met: 'met', partly: 'partly met', not_met: 'not met', unknown: 'unknown' };
  var LEDE = { ideal: 'ideal', fruit: 'what', pattern: 'summary', mechanism: 'definition', text: 'quote' };
  var THREAD_ORDER = ['ideal', 'carrier', 'vehicle', 'funder', 'lab', 'evaluator', 'fruit', 'pattern', 'mechanism', 'text', 'offshoot'];
  var THREAD_NAME = { ideal: 'Ideals', carrier: 'Movements, groups and voices', vehicle: 'What it runs on', funder: 'Funders',
    lab: 'AI companies', evaluator: 'Evaluators', fruit: 'Events', pattern: 'Ancient patterns', mechanism: 'How it takes hold',
    text: 'Old texts', offshoot: 'Offshoots' };

  function personFor(ix, id) { return (ix.g.people || []).filter(function (p) { return p.node === id; })[0]; }
  function personById(ix, id) { return (ix.g.people || []).filter(function (p) { return p.id === id; })[0]; }
  function nameOf(n) { return n.label || n.ref || n.name || n.title || n.id; }

  /* Every URL a record itself cites (not its neighbours'), with the flag it carries. */
  var RANK = { primary: 3, secondary: 2, unverified: 1 };
  function ownSources(x) {
    var out = {};
    (function walk(o) {
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (!o || typeof o !== 'object') return;
      if (typeof o.url === 'string' && /^https?:\/\//.test(o.url)) {
        var cur = out[o.url];
        if (!cur) out[o.url] = cur = { url: o.url, source: o.source || o.work || o.title || o.url, flag: o.verified, nolink: o.nolink };
        /* A page cited more than once keeps the best check any citation of it had. */
        if ((RANK[o.verified] || 0) > (RANK[cur.flag] || 0)) cur.flag = o.verified;
        if (cur.source === cur.url && (o.source || o.work || o.title)) cur.source = o.source || o.work || o.title;
      }
      Object.keys(o).forEach(function (k) { if (k !== 'url') walk(o[k]); });
    })(x);
    return Object.keys(out).map(function (k) { return out[k]; });
  }

  /* The trail: who drafted it, how much a model checked at the source, how much a person has re-read. */
  function trail(ix, ui, srcs, x) {
    var box = ui.h('div', 'trail');
    var primary = srcs.filter(function (s) { return s.flag === 'primary'; }).length;
    var checked = srcs.filter(function (s) { return s.flag === 'primary' || s.flag === 'secondary'; }).length;
    var reread = srcs.filter(function (s) { var r = ix.reread[s.url]; return r && (r.result === 'holds' || r.result === 'corrected'); }).length;
    var steps = [
      ['Drafted', x.drafted_by || 'by AI models made by Anthropic', true],
      ['Checked by a model', srcs.length ? checked + ' of ' + srcs.length + ' sources' + (primary ? ' (' + primary + ' at the source itself)' : '') : 'no sources of its own', checked > 0],
      ['Re-read by a person', srcs.length ? reread + ' of ' + srcs.length + ' sources' : '—', reread > 0 && reread === srcs.length]
    ];
    steps.forEach(function (s, i) {
      var st = ui.h('div', 'trail-step' + (s[2] ? ' is-done' : '') + (i === 2 && reread > 0 && reread < srcs.length ? ' is-part' : ''));
      ui.add(st, ui.h('span', 'trail-dot'), ui.add(ui.h('span', 'trail-text'), ui.h('b', null, s[0]), ui.h('span', null, ' ' + s[1])));
      ui.add(box, st);
    });
    return box;
  }

  function recBtn(ui, nav, id, text) {
    var b = ui.h('button', 'linkbtn', text); b.type = 'button';
    b.addEventListener('click', function () { nav.goRecord(id); });
    return b;
  }
  function list(ui, title, note, items) {
    if (!items.length) return null;
    var s = ui.section(title, note), ul = ui.h('ul', 'links rec-list');
    items.forEach(function (li) { ui.add(ul, li); });
    return ui.add(s, ul);
  }

  ns.renderRecord = function (box, ix, ui, nav, id) {
    while (box.firstChild) box.removeChild(box.firstChild);
    var method = ns.methodById && ns.methodById(ix, id);
    if (method) { ns.renderMethodRecord(box, ix, ui, nav, method, trail(ix, ui, ownSources(method), method)); return; }
    var person = personById(ix, id);
    if (person && person.node && ix.byId[person.node]) { id = person.node; }
    var n = ix.byId[id];
    if (!n && !person) { ui.add(box, ui.h('p', null, 'No record has that address.')); return; }
    person = person || (n && personFor(ix, id));
    var head = ui.h('header', 'rec-head');
    ui.add(head, ui.h('p', 'kicker', n ? ns.nodeWord(n) : 'Who’s who'), ui.h('h2', 'rec-title', n ? nameOf(n) : person.name));
    var lede = n ? (n[LEDE[n.type]] || n.note || n.status || '') : '';
    if (person) ui.add(head, ui.add(ui.h('p', 'rec-who'), ui.h('span', null, person.who + ' '), ui.link(person.url, person.source, person.nolink)));
    if (lede && !(person && lede === person.who)) ui.add(head, ui.h('p', 'rec-lede', (n.type === 'text' ? '“' + lede + '” ' + n.ref : lede)));
    if (n && n.type === 'text') {
      var tc = ui.h('p', 'cite');
      ui.add(tc, ui.h('span', null, ns.tradition(n) + ' · ' + (n.translation || 'King James Version') + (n.url ? (/[.!?]$/.test(n.translation || '') ? ' ' : '. ') : '')));
      if (n.url) ui.add(tc, ui.link(n.url, 'source'), ui.h('span', null, ' '), ui.badge(n.verified, n.url));
      ui.add(head, tc);
    }
    if (n && n.type === 'fruit') ui.add(head, ui.add(ui.h('p', 'cite'), ui.h('span', null, n.date + ' · ' + n.kind + ' · '), ui.link(n.url, n.source || 'source', n.nolink), ui.h('span', null, ' '), ui.badge(n.verified, n.url)));
    var srcs = ownSources(n || person);
    ui.add(head, trail(ix, ui, srcs, n || person));
    var acts = ui.h('p', 'rec-actions');
    if (n) { var m = ui.h('button', 'linkbtn', 'See it on the map'); m.type = 'button'; m.addEventListener('click', function () { nav.openNode(id); }); ui.add(acts, m); }
    if (person) { var w = ui.h('button', 'linkbtn', 'Who’s who'); w.type = 'button'; w.addEventListener('click', function () { nav.goPeople(person.id); }); ui.add(acts, w); }
    ui.add(head, acts);
    ui.add(box, head);

    if (n && n.type === 'ideal') {
      var ph = ui.section('Where it stands', 'Six steps an ideal can pass through. Each turns when its conditions are met, never on a date. Nothing here is a forecast.');
      var ol = ui.h('ol', 'rec-phases'), sum = ns.phaseSummary(n);
      (ix.g.phases || []).forEach(function (p, i) {
        var li = ui.h('li', 'ph-' + sum[i]);
        ui.add(li, ui.h('b', null, p.name + ': '), ui.h('span', null, p.what + ' '), ui.h('span', 'lane', PHASE[sum[i]]));
        ui.add(ol, li);
      });
      ui.add(box, ui.add(ph, ol));
    }
    if (n && (n.words || []).length) ui.add(box, ui.add(ui.section('In their own words'), ui.quoteList(n.words)));
    if (n && n.policy) ui.add(box, ui.add(ui.section('Its own rule on funding'), ui.quoteList([n.policy])));

    var pushes = n && ns.methodsPushedBy ? ns.methodsPushedBy(ix, id) : [];
    ui.add(box, list(ui, 'Alignment methods it pushes or uses', 'Each method is asked the same five questions; open one to see what it takes for granted.', pushes.map(function (m) {
      var how = (m.pushed_by || []).filter(function (p) { return p.node === id; })[0];
      return ui.add(ui.h('li'), recBtn(ui, nav, m.id, m.label), ui.h('span', null, how ? ' \u2014 ' + how.how : ''));
    })));
    var adj = n ? ix.adj[id] || [] : [];
    /* Events: an ideal's come from its whole neighbourhood, as on the map; anything else's from its own links. */
    var evIds = {};
    if (n && n.type === 'ideal') Object.keys(ns.members(ix, id)).forEach(function (m) { if (ix.byId[m].type === 'fruit') evIds[m] = true; });
    adj.forEach(function (l) { if (ix.byId[l.other].type === 'fruit' && !ns.isMoney(l.edge)) evIds[l.other] = true; });
    var evs = Object.keys(evIds).map(function (k) { return ix.byId[k]; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    ui.add(box, list(ui, 'What has happened (' + evs.length + ')', 'Newest first. Documented: a record shows it. Reported: the press says so. Alleged: someone accuses; nothing is decided.', evs.map(function (f) {
      return ui.add(ui.h('li'), ui.h('span', 'rec-date', f.date + ' '), recBtn(ui, nav, f.id, f.label || f.what), ui.h('span', 'lane', f.kind), ui.h('span', null, ' '), ui.badge(f.verified, f.url));
    })));

    var money = adj.filter(function (l) { return ns.isMoney(l.edge); });
    ui.add(box, list(ui, 'Money, hosting and evaluation (' + money.length + ')', 'A record of money is not a finding about anyone’s work or motive. Amounts are as each source gives them; do not add them up.', money.map(function (l) {
      var e = l.edge;
      return ui.add(ui.h('li'), ui.h('span', null, (e.sentence || '') + ' '), e.amount ? ui.h('span', 'lane', e.amount) : null, ui.h('span', null, ' '),
        e.url ? ui.link(e.url, e.source || 'source', e.nolink) : null, ui.h('span', null, ' '), e.verified ? ui.badge(e.verified, e.url) : null, ui.h('span', null, ' '), recBtn(ui, nav, l.other, '→ ' + nameOf(ix.byId[l.other])));
    })));

    var anc = adj.filter(function (l) { return l.edge.type === 'invokes' || l.edge.type === 'reads_as' || l.edge.type === 'parallels'; });
    /* Own words first, then readings, each group by the tradition of the text it names. */
    anc = anc.filter(function (l) { return l.edge.type === 'invokes'; }).concat(ns.byTradition(anc.filter(function (l) { return l.edge.type !== 'invokes'; }), function (l) {
      var o = ix.byId[l.other]; return o && o.type === 'text' ? ns.tradition(o) : 'zz';
    }));
    ui.add(box, list(ui, 'What older traditions called it', 'Own words are a speaker’s; a reading is this project’s and says where the likeness stops. A reading never proves anything.', anc.map(function (l) {
      var e = l.edge, own = e.type === 'invokes';
      var o = ix.byId[l.other], trad = o && o.type === 'text' ? ' · ' + ns.tradition(o) : '';
      return ui.add(ui.h('li'), ui.h('span', 'lane', (own ? 'own words' : 'this project’s reading') + trad), ui.h('span', null, ' ' + (e.sentence || '') + (e.limit ? ' Where it stops: ' + e.limit : '') + ' '), recBtn(ui, nav, l.other, '→ ' + nameOf(o)));
    })));

    /* Threads: everything else it links to, grouped by kind, each with the sentence that says how. */
    var rest = adj.filter(function (l) { return !ns.isMoney(l.edge) && anc.indexOf(l) < 0 && ix.byId[l.other].type !== 'fruit'; });
    var groups = {};
    rest.forEach(function (l) { var t = ix.byId[l.other].type; (groups[t] = groups[t] || []).push(l); });
    var th = ui.section('Threads', 'Everything this record links to, and how.');
    var any = false;
    THREAD_ORDER.forEach(function (t) {
      if (!groups[t]) return;
      any = true;
      var ul = ui.h('ul', 'links rec-list');
      groups[t].forEach(function (l) {
        ui.add(ul, ui.add(ui.h('li', l.edge.lens ? 'is-lens' : null), recBtn(ui, nav, l.other, nameOf(ix.byId[l.other])), ui.h('span', null, ' — ' + (l.edge.sentence || l.edge.type.replace(/_/g, ' '))), l.edge.lens ? ui.h('span', 'lane', 'a reading') : null));
      });
      ui.add(th, ui.h('h4', 'rec-sub', THREAD_NAME[t] || t), ul);
    });
    /* Claims on the Watch that touch it, and where the person is mentioned in other records' words. */
    var claims = (ix.g.watch || []).filter(function (w) { return (w.touches || []).indexOf(id) >= 0; });
    if (claims.length) {
      any = true;
      var cl = ui.h('ul', 'links rec-list');
      claims.forEach(function (w) { var b = ui.h('button', 'linkbtn', w.title); b.type = 'button'; b.addEventListener('click', function () { nav.goWatch(w.id); }); ui.add(cl, ui.add(ui.h('li'), ui.h('span', 'rec-date', w.date + ' '), b)); });
      ui.add(th, ui.h('h4', 'rec-sub', 'Claims on the Watch'), cl);
    }
    if (person) {
      var forms = person.match && person.match.length ? person.match : [person.name];
      var re = new RegExp('(^|[^A-Za-z])(' + forms.map(function (f) { return f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')(?![A-Za-z])');
      var hits = Object.keys(ix.byId).filter(function (k) { return k !== id && re.test(JSON.stringify(ix.byId[k])); });
      var wh = (ix.g.watch || []).filter(function (w) { return re.test(JSON.stringify(w)) && claims.indexOf(w) < 0; });
      if (hits.length || wh.length) {
        any = true;
        var ml = ui.h('ul', 'links rec-list');
        hits.sort(function (a, b) { return THREAD_ORDER.indexOf(ix.byId[a].type) - THREAD_ORDER.indexOf(ix.byId[b].type); }).forEach(function (k) {
          ui.add(ml, ui.add(ui.h('li'), recBtn(ui, nav, k, nameOf(ix.byId[k])), ui.h('span', 'lane', ns.nodeWord(ix.byId[k]))));
        });
        wh.forEach(function (w) { var b = ui.h('button', 'linkbtn', w.title); b.type = 'button'; b.addEventListener('click', function () { nav.goWatch(w.id); }); ui.add(ml, ui.add(ui.h('li'), b, ui.h('span', 'lane', 'claim on the Watch'))); });
        ui.add(th, ui.h('h4', 'rec-sub', 'Where ' + person.name + ' is mentioned'), ml);
      }
    }
    if (any) ui.add(box, th);

    var care = (n && (n.cautions || [])) || [];
    if (n && n.why_not) care = care.concat([n.why_not]);
    ui.add(box, list(ui, 'Read with care', null, care.map(function (c) { return ui.h('li', null, c); })));
    ui.add(box, list(ui, 'Sources (' + srcs.length + ')', 'Every page this record cites, with how it was checked.', srcs.map(function (s) {
      return ui.add(ui.h('li'), ui.link(s.url, s.source, s.nolink), ui.h('span', null, ' '), s.flag ? ui.badge(s.flag, s.url) : ui.h('span', 'lane', 'a reading or summary'));
    })));
    var rid = n ? id : person.id;
    ui.add(box, ns.recordFoot(ix, ui, { id: rid, title: n ? nameOf(n) : person.name, hash: '#r/' + rid }));
  };
})(window.IdealsMap = window.IdealsMap || {});
