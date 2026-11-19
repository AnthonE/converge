/* Test for the phone re-read page. Usage: node test/reread.js <dir>
   <dir> holds reread.html, reread.js, reread.css and reread-queue.json (see README, "Test the viewer").
   It answers pages at phone size, checks that "does not hold" asks for a note, that saving opens GitHub's new-file
   page with the answers filled in, that answers survive a reload, and that they leave the phone once the queue
   carries them. Fails (exit 1) on any console error or a step that does not work. */
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const dir = path.resolve(process.argv[2]);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(dir, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  if (!f.startsWith(dir) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/reread.html`;
  const queue = JSON.parse(fs.readFileSync(path.join(dir, 'reread-queue.json'), 'utf8'));
  const errors = [], fail = m => errors.push(m);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { window.__opened = []; window.open = u => { window.__opened.push(u); return null; }; });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto(base);
  await page.waitForSelector('.card .open');
  const gate = queue.pages.filter(p => p.gate);
  if ((await page.locator('.url').textContent()) !== (gate[0] || queue.pages[0]).url) fail('the first page shown is not the first in the queue');
  const count = async () => parseInt(await page.locator('.bar b').first().textContent(), 10);
  const start = await count();
  if (start !== gate.filter(p => p.reread).length) fail(`the progress line starts at ${start}`);
  await page.locator('button.holds').click();
  await page.locator('button.nothold').click();
  if (!(await page.locator('#note').isVisible())) fail('"does not hold" with no note does not ask for one');
  await page.locator('#note').fill('The page says something else.');
  await page.locator('button.nothold').click();
  if (!/^2 answers are on this phone/.test(await page.locator('#save p').first().textContent())) fail('the save line does not count two answers');
  if (queue.repo) {
    await page.locator('#save button.primary').click();
    const url = new URL((await page.evaluate(() => window.__opened))[0] || 'http://x/');
    if (url.host !== 'github.com' || url.pathname !== `/${queue.repo}/new/${queue.branch}/${queue.inbox}`) fail(`saving opens ${url.href.slice(0, 120)}`);
    let rows = [];
    try { rows = JSON.parse(url.searchParams.get('value')); } catch (e) { fail('the saved file is not JSON'); }
    if (rows.length !== 2 || rows[0].result !== 'holds' || rows[1].result !== 'does not hold' || !rows[1].note) fail('the saved file does not hold the two answers');
    if (!rows.every(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && /^https?:\/\//.test(r.url))) fail('a saved answer has no date or address');
    if (!/^\d{4}-\d{2}-\d{2}-\d{6}-[a-z0-9]+\.json$/.test(url.searchParams.get('filename') || '')) fail('the new file has no dated name');
  }
  await page.reload();
  await page.waitForSelector('.card');
  if (!(await page.locator('#save').isVisible())) fail('answers are lost on reload');
  if ((await count()) !== start + 2) fail('the progress line forgets answers on reload');

  // Once the queue carries the same readings (the site has rebuilt with them), they leave the phone's list.
  const answered = JSON.parse(await page.evaluate(() => localStorage.getItem('ideals-map-reread-v1')));
  await page.route('**/reread-queue.json', route => {
    const q = JSON.parse(JSON.stringify(queue));
    q.pages.forEach(p => { const a = answered[p.url]; if (a) p.reread = { url: a.url, date: a.date, result: a.result, note: a.note }; });
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(q) });
  });
  await page.reload();
  await page.waitForSelector('.card');
  if (await page.locator('#save').isVisible()) fail('answers the site already has stay on the phone');
  if ((await count()) !== start + 2) fail('the progress line does not count the saved answers');

  await browser.close(); server.close();
  if (errors.length) { console.log('FAIL'); errors.forEach(e => console.log(' -', e)); process.exit(1); }
  console.log(`PASS: the phone re-read page (${queue.pages.length} pages, ${gate.length} before going public)`);
})();
