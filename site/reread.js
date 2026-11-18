/* The re-read, on a phone. Answers are kept in this browser as soon as they are given; "Save to the map" opens
   GitHub's new-file page with them filled in, so saving is one commit to data/reread-inbox/, which the build merges
   into the ledger. All text enters the page through textContent. */
(function () {
  'use strict';
  var KEY = 'ideals-map-reread-v1', DONE = /^(holds|corrected|removed)$/, MAXURL = 6000;
  var WORD = { 'holds': 'it holds', 'does not hold': 'does not hold', 'could not read': 'could not read it', 'corrected': 'corrected', 'removed': 'removed' };
  var Q = null, cur = null, local = {}, canStore = true, filterEl = document.getElementById('filter');

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function add(p) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) p.appendChild(arguments[i]); return p; }
  function btn(cls, text, fn) { var b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function read() { try { local = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { local = {}; canStore = false; } }
  function store() { try { localStorage.setItem(KEY, JSON.stringify(local)); canStore = true; } catch (e) { canStore = false; } }
  /* An answer given here and not yet on the site stands over the saved one. */
  function answer(p) { return local[p.url] || p.reread || null; }
  function pending() { return Object.keys(local).map(function (k) { return local[k]; }); }

  function visible() {
    var f = filterEl.value;
    return Q.pages.filter(function (p) {
      var a = answer(p);
      if (f === 'gate') return p.gate;
      if (f === 'todo') return !a;
      if (f === 'flagged') return a && a.result === 'does not hold';
      return true;
    });
  }
  function next(after) {
    var v = visible(), i = after ? v.indexOf(after) : -1;
    var rest = v.slice(i + 1).concat(v.slice(0, i + 1));
    return rest.filter(function (p) { return !answer(p); })[0] || null;
  }

  function bar(label, list) {
    var a = list.map(answer).filter(Boolean), n = function (r) { return a.filter(function (x) { return r.test(x.result); }).length; };
    var b = el('div', 'bar'), t = el('div', 'track'), f = el('div', 'fill');
    f.style.width = (list.length ? Math.round(100 * a.length / list.length) : 0) + '%';
    var parts = [n(DONE) + ' hold', n(/^does not hold$/) + ' to fix', n(/^could not read$/) + ' could not be read'];
    return add(b, add(el('div'), el('b', null, a.length + ' of ' + list.length), el('span', null, ' answered ' + label + ' · ' + parts.join(' · '))), add(t, f));
  }

  /* What is on this phone and not yet on the site, and the way to save it. */
  function paintSave() {
    var box = document.getElementById('save'), all = pending();
    box.textContent = '';
    box.hidden = !all.length && canStore;
    if (!canStore) add(box, el('p', null, 'This browser is not keeping answers (a private window, or storage turned off). Answers given now are lost when the page closes.'));
    if (!all.length) return;
    var unsent = all.filter(function (a) { return !a.sent; }), row = el('div', 'row');
    if (unsent.length) {
      add(box, el('p', null, unsent.length + (unsent.length === 1 ? ' answer is' : ' answers are') + ' on this phone and not yet on the map.'));
      if (Q.repo) add(row, btn('primary', 'Save ' + (unsent.length === 1 ? 'it' : 'them') + ' to the map', saveToGitHub));
    } else {
      add(box, el('p', null, all.length + (all.length === 1 ? ' answer was' : ' answers were') + ' sent to GitHub. They leave this list once the site has rebuilt with them (a few minutes after you tap Commit changes).'));
      if (Q.repo) add(row, btn('small', 'I did not commit them: send again', function () { all.forEach(function (a) { delete a.sent; }); store(); paintSave(); }));
    }
    add(row, btn('small', 'Copy my answers', copy));
    add(box, row);
  }
  function rows(list) {
    return '[\n' + list.map(function (a) {
      var r = { url: a.url, date: a.date, result: a.result, at: a.at };
      if (a.note) r.note = a.note;
      return JSON.stringify(r);
    }).join(',\n') + '\n]\n';
  }
  function saveToGitHub() {
    var unsent = pending().filter(function (a) { return !a.sent; }), batch = [];
    /* A link has a length limit: send what fits, and the rest with the next tap. */
    unsent.forEach(function (a) { if (!batch.length || encodeURIComponent(rows(batch.concat([a]))).length < MAXURL) batch.push(a); });
    var d = new Date(), name = today() + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '-' + Math.random().toString(36).slice(2, 6) + '.json';
    var url = 'https://github.com/' + Q.repo + '/new/' + encodeURIComponent(Q.branch || 'main') + '/' + Q.inbox +
      '?filename=' + encodeURIComponent(name) + '&value=' + encodeURIComponent(rows(batch));
    var stamp = new Date().toISOString();
    batch.forEach(function (a) { a.sent = stamp; });
    store();
    window.open(url, '_blank', 'noopener');
    paintSave();
    toast(batch.length < unsent.length ? 'Sent ' + batch.length + ' of ' + unsent.length + '. Commit them on GitHub, then tap Save again for the rest.' : 'On GitHub, tap Commit changes, then again in the box that opens.');
  }
  function copy() {
    var text = 'Readings from the phone re-read page, to add to data/reread-inbox/:\n' + rows(pending());
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast('Copied. Paste it to Claude and ask it to add your readings.'); }, function () { toast('Could not copy.'); });
    else toast('This browser cannot copy from here.');
  }

  function verdict(p) {
    var pc = p.precheck, d = el('div', 'verdict'), quoted = p.items.some(function (x) { return x.quotes.length; });
    if (!quoted) { d.className += ' v-warn'; d.textContent = 'Nothing from this page is quoted on the map. Check that it says what the map says it shows.'; return d; }
    if (!pc) { d.className += ' v-warn'; d.textContent = 'No automatic check for this page yet. Read it yourself.'; return d; }
    if (pc.status !== 'text') { d.className += ' v-warn'; d.textContent = 'The script could not read this page (' + pc.status + '). Read it yourself.'; return d; }
    var miss = (pc.quotes || []).filter(function (q) { return q.result === 'not found'; }).length;
    if (!miss) { d.className += ' v-ok'; d.textContent = 'A script found every quoted word on this page. Check they are in context and said by who the map says.'; }
    else { d.className += ' v-bad'; d.textContent = 'A script could not find ' + miss + ' of ' + pc.quotes.length + ' quoted passages. Read carefully: the words may be elsewhere, load late, or not be there.'; }
    return d;
  }

  function show(p) {
    cur = p;
    var main = document.getElementById('main'); main.textContent = '';
    if (!p) {
      var c0 = el('div', 'card empty');
      add(c0, el('p', null, filterEl.value === 'gate' ? 'Every page to read before going public has an answer.' : 'Nothing left in this list.'));
      if (pending().length) add(c0, el('p', null, 'Save your answers to the map with the button at the top.'));
      add(main, c0); paint(); return;
    }
    var c = el('div', 'card'), pre = {};
    ((p.precheck && p.precheck.quotes) || []).forEach(function (q) { pre[q.quote] = q; });
    add(c, el('span', 'kicker', (Q.tiers[p.tier] || '') + ' · ' + p.host), el('p', 'url', p.url));
    var a = el('a', 'open', 'Open the page ↗'); a.href = p.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    add(c, a, verdict(p), el('span', 'kicker', 'What the map takes from it (' + p.items.length + ')'));
    var ul = el('ul', 'items');
    p.items.forEach(function (x) {
      var li = el('li');
      add(li, el('div', 'where', x.where + (x.flag && x.flag !== 'none' ? ' · machine flag: ' + x.flag : '')), x.text ? el('p', 'text', x.text) : null);
      x.quotes.forEach(function (q) {
        var r = pre[q], box = el('div', 'q' + (r ? (r.result === 'not found' ? ' missing' : ' found') : ''));
        add(box, el('span', null, '“' + q + '”'), r ? el('span', 'chip', r.result) : null);
        if (r && r.context) add(box, el('div', 'ctx', '…' + r.context + '…'));
        add(li, box);
      });
      add(ul, li);
    });
    add(c, ul);
    var act = el('div', 'actions'), ans = answer(p);
    if (ans) add(act, el('p', 'already', 'Your answer: ' + (WORD[ans.result] || ans.result) + (local[p.url] ? ' (on this phone, not yet saved)' : ', saved ' + ans.date) + (ans.note ? ': ' + ans.note : '')));
    var note = el('textarea'); note.id = 'note'; note.placeholder = 'What does the page actually say? (needed for “does not hold”)';
    if (ans && ans.note) note.value = ans.note; else note.hidden = true;
    var btns = el('div', 'btns'), more = el('div', 'more');
    add(btns, btn('holds', 'It holds', function () { mark('holds'); }), btn('nothold', 'Doesn’t hold', function () { mark('does not hold'); }),
      btn(null, 'Can’t read', function () { mark('could not read'); }));
    add(more, btn('link', 'Skip this page', function () { var v = visible(); show(v[(v.indexOf(p) + 1) % v.length] || p); }),
      note.hidden ? btn('link', 'Add a note', function () { note.hidden = false; note.focus(); }) : null);
    add(c, add(act, note, btns, more));
    add(main, c);
    paint();
    window.scrollTo(0, 0);
  }

  function paint() {
    var ul = document.getElementById('list'); ul.textContent = '';
    visible().forEach(function (p) {
      var a = answer(p), li = el('li', p === cur ? 'cur' : null);
      add(li, el('span', 'dot' + (a ? ' d-' + a.result.replace(/ /g, '-') : '') + (local[p.url] ? ' d-local' : '')), el('span', 'host', p.host), el('span', 'where', String(p.items.length)));
      li.title = p.url;
      li.addEventListener('click', function () { show(p); });
      add(ul, li);
    });
    var b = document.getElementById('bars'); b.textContent = '';
    var all = Q.pages.filter(function (p) { return answer(p); }).length;
    add(b, bar('before going public', Q.pages.filter(function (p) { return p.gate; })), el('p', 'where', 'All cited pages: ' + all + ' of ' + Q.pages.length + ' answered.'));
    paintSave();
  }

  function toast(msg, undo) {
    var t = document.getElementById('toast'); t.textContent = '';
    add(t, el('span', null, msg), undo ? btn(null, 'Undo', function () { undo(); t.hidden = true; }) : null);
    t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 6000);
  }

  function mark(result) {
    var p = cur, note = document.getElementById('note'), text = note.value.trim(), before = local[p.url];
    if (result === 'does not hold' && !text) { note.hidden = false; note.focus(); toast('Say what the page actually says, then tap “Does not hold” again.'); return; }
    var r = { url: p.url, result: result, date: today(), at: new Date().toISOString() };
    if (text) r.note = text;
    local[p.url] = r;
    store();
    toast('Kept on this phone: ' + WORD[result], function () { if (before) local[p.url] = before; else delete local[p.url]; store(); show(p); });
    show(next(p));
  }

  /* An answer leaves this phone's list once the published site carries the same reading. */
  function settle() {
    var byUrl = {};
    Q.pages.forEach(function (p) { byUrl[p.url] = p; });
    Object.keys(local).forEach(function (u) {
      var a = local[u], s = byUrl[u] && byUrl[u].reread;
      if (!byUrl[u] || (s && s.result === a.result && s.date === a.date && (s.note || '') === (a.note || ''))) delete local[u];
    });
    store();
  }

  try { filterEl.value = localStorage.getItem(KEY + '-filter') || 'gate'; } catch (e) { /* no storage */ }
  filterEl.addEventListener('change', function () { try { localStorage.setItem(KEY + '-filter', filterEl.value); } catch (e) { /* no storage */ } show(next()); });
  read();
  fetch('reread-queue.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (q) {
    Q = q; settle(); show(next());
  }).catch(function (e) {
    document.getElementById('main').textContent = 'Could not load the list of pages (' + e.message + '). The site may still be building; try again in a minute.';
  });
})();
