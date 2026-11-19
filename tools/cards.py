#!/usr/bin/env python3
"""Draw the preview images a shared link shows (1200 x 630): one for the site and one per ideal.

  python3 build.py && python3 tools/cards.py          -> site/cards/<id>.png and site/cards/cards.json

Run it by hand when an ideal's name, statement or lead quotation changes; it needs Node and Playwright, which the
host's build does not have, so the images are kept in the repository. cards.json records the words each image was
drawn from. tools/pages.py uses an image only while those words still match the data; a stale one falls back to
the site's image, so a preview never shows words the map no longer carries.
"""
import html, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from pages import card_text, card_hash  # noqa: E402

CSS = """
* { box-sizing: border-box; margin: 0; }
html, body { width: 1200px; height: 630px; }
body { background: #f9f9f7; color: #0b0b0b; font-family: Inter, "DejaVu Sans", sans-serif; }
.card { width: 1200px; height: 630px; padding: 56px 72px 44px; display: flex; flex-direction: column;
        border-top: 14px solid #2a78d6; }
.kicker { font-size: 22px; letter-spacing: 0.08em; text-transform: uppercase; color: #52514e; margin-bottom: 18px; }
h1 { font-family: "Inter Display", Inter, sans-serif; font-size: 70px; line-height: 1.04; font-weight: 700; margin-bottom: 18px; }
.lede { font-size: 31px; line-height: 1.32; color: #2b2a28; max-width: 1030px; }
.quote { margin-top: 26px; padding-left: 22px; border-left: 5px solid #c3c2b7; font-size: 27px; line-height: 1.36;
         font-style: italic; max-width: 1020px; }
.who { margin-top: 10px; padding-left: 27px; font-size: 20px; color: #52514e; }
.foot { margin-top: auto; padding-top: 18px; border-top: 1px solid #e1e0d9; font-size: 21px; color: #52514e;
        display: flex; justify-content: space-between; gap: 24px; }
.foot b { color: #0b0b0b; font-weight: 650; }
.home h1 { font-size: 96px; margin-top: 40px; }
.home .lede { font-size: 38px; }
.tight h1 { font-size: 56px; } .tight .lede { font-size: 26px; } .tight .quote { font-size: 23px; }
"""


def page(t, home):
    q = f'<p class="quote">{html.escape(t["quote"])}</p><p class="who">{html.escape(t["who"])}</p>' if t['quote'] else ''
    return (f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>'
            f'<div class="card{" home" if home else ""}"><p class="kicker">{html.escape(t["kicker"])}</p>'
            f'<h1>{html.escape(t["title"])}</h1><p class="lede">{html.escape(t["lede"])}</p>{q}'
            f'<p class="foot"><span>{html.escape(t["foot"])}</span><b>The Ideals Map</b></p></div></body></html>')


SHOT = r"""
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const [src, out] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const f of fs.readdirSync(src).filter(f => f.endsWith('.html'))) {
    await page.goto('file://' + path.join(src, f));
    /* Longer words get a smaller size rather than running off the image. */
    const over = await page.evaluate(() => { const c = document.querySelector('.card'); if (c.scrollHeight > 630) c.classList.add('tight'); return c.scrollHeight > 630; });
    if (over) console.error('still too long for the image: ' + f);
    await page.screenshot({ path: path.join(out, f.replace(/\.html$/, '.png')) });
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
"""


def main():
    g = json.load(open(os.path.join(ROOT, 'site', 'graph.json'), encoding='utf-8'))
    tmp, out = os.path.join(ROOT, 'dist', 'cards'), os.path.join(ROOT, 'site', 'cards')
    os.makedirs(tmp, exist_ok=True)
    os.makedirs(out, exist_ok=True)
    made = {}
    for cid in ['home'] + [d['id'] for d in g.get('ideals') or []]:
        t = card_text(g, cid)
        with open(os.path.join(tmp, cid + '.html'), 'w', encoding='utf-8') as fh:
            fh.write(page(t, cid == 'home'))
        made[cid] = {'file': cid + '.png', 'hash': card_hash(t)}
    js = os.path.join(tmp, 'shot.js')
    open(js, 'w').write(SHOT)
    subprocess.run(['node', js, tmp, out], check=True)
    with open(os.path.join(out, 'cards.json'), 'w', encoding='utf-8') as fh:
        json.dump(made, fh, indent=1, sort_keys=True)
        fh.write('\n')
    print(f'cards: {len(made)} images in {os.path.relpath(out, ROOT)}')


if __name__ == '__main__':
    main()
