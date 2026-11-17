/* The Watch: claims being passed around, dated, each with who made it, what has been checked so far, and any
   responses. Not a verdict. A claim here is not a finding, and an unchecked claim is not false. */
(function (ns) {
  'use strict';

  var STATUS = {
    'not checked': 'Not yet checked',
    'partly checked': 'Partly checked',
    'checked': 'Checked: the sources say what the claim says',
    'not supported': 'Checked: the sources read do not support it',
    'source not found': 'No primary source found yet'
  };
  var RESULT = {
    'supports': 'supports', 'partly supports': 'partly supports', 'does not support': 'does not support',
    'not found': 'not found', 'could not read': 'could not be read'
  };
  ns.watchStatus = STATUS;
  ns.hasWatch = function (ix) { return (ix.g.watch || []).length > 0; };

  function item(ui, w, ix, onNode) {
    var art = ui.h('article', 'claim');
    art.id = 'watch-' + w.id;
    var head = ui.h('header', 'claim-head');
    ui.add(head, ui.h('time', null, w.date), ui.h('span', 'claim-status status-' + w.status.replace(/ /g, '-'), STATUS[w.status] || w.status),
      ui.h('span', 'lane', w.kind));
    ui.add(art, head, ui.h('h3', null, w.title));
    var said = ui.h('p', 'claim-said');
    ui.add(said, ui.h('span', null, w.claimed_by + ': '), ui.h('q', null, w.claim), ui.h('span', null, ' '),
      ui.link(w.url, w.source, w.nolink));
    ui.add(art, said);
    if (w.standing) ui.add(art, ui.h('p', 'claim-standing', 'Who is speaking: ' + w.standing));
    if ((w.checks || []).length) {
      var s = ui.section('What has been checked (' + w.checks.length + ')', 'Each line says what was looked for, where, and what the page said.');
      var ul = ui.h('ul', 'links');
      w.checks.forEach(function (c) {
        var li = ui.h('li', 'check');
        ui.add(li, ui.h('span', 'lane result-' + c.result.replace(/ /g, '-'), RESULT[c.result] || c.result), ui.h('span', null, ' ' + c.what + ' '),
          c.url ? ui.link(c.url, c.source, c.nolink) : ui.h('span', 'cite', '(' + (c.source || '') + ')'), ui.h('span', null, ' '), c.verified ? ui.badge(c.verified) : null);
        ui.add(ul, li);
      });
      ui.add(art, ui.add(s, ul));
    }
    if ((w.responses || []).length) {
      var rs = ui.section('Responses on the record'), rl = ui.h('ul', 'links');
      w.responses.forEach(function (r) {
        ui.add(rl, ui.add(ui.h('li'), ui.h('span', null, r.who + ': ' + r.what + ' '), r.url ? ui.link(r.url, r.source, r.nolink) : ui.h('span', null, r.source || '')));
      });
      ui.add(art, ui.add(rs, rl));
    }
    if ((w.open || []).length) {
      var os = ui.section('Still open'), ol = ui.h('ul');
      w.open.forEach(function (o) { ui.add(ol, ui.h('li', null, o)); });
      ui.add(art, ui.add(os, ol));
    }
    if ((w.cautions || []).length) {
      var cs = ui.section('Read with care'), cl = ui.h('ul');
      w.cautions.forEach(function (c) { ui.add(cl, ui.h('li', null, c)); });
      ui.add(art, ui.add(cs, cl));
    }
    var on = (w.touches || []).filter(function (id) { return ix.byId[id]; });
    if (on.length) {
      var p = ui.h('p', 'claim-on');
      ui.add(p, ui.h('span', null, 'On the map: '));
      on.forEach(function (id, i) {
        var b = ui.h('button', 'linkbtn', ix.byId[id].label || ix.byId[id].ref);
        b.type = 'button';
        b.addEventListener('click', function () { onNode(id); });
        ui.add(p, i ? ui.h('span', null, ', ') : null, b);
      });
      ui.add(art, p);
    }
    return art;
  }

  /* The whole Watch, newest first. */
  ns.renderWatch = function (box, ix, ui, onNode) {
    while (box.firstChild) box.removeChild(box.firstChild);
    var intro = ui.h('div', 'watch-intro');
    ui.add(intro, ui.h('h2', null, 'The Watch'),
      ui.h('p', null, 'Claims being passed around about AI and the people building it, dated, each with who made it and what has been checked so far. This is a timeline of claims and evidence, not a verdict. A claim here is not a finding, and an unchecked claim is not false. Follow the sources and come to your own conclusion.'),
      ui.h('p', 'note', 'A claim moves onto the map only once its sources are checked. People who are not public figures are not named. ' + (((ix.g.meta || {}).made_with) || '')));
    ui.add(box, intro);
    (ix.g.watch || []).slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || a.title.localeCompare(b.title); })
      .forEach(function (w) { ui.add(box, item(ui, w, ix, onNode)); });
  };
})(window.IdealsMap = window.IdealsMap || {});
