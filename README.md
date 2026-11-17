# The Ideals Map

A linked map of what the movements around AI say they serve, who carries each ideal, what it runs on, what has
happened, who pays and who evaluates, how each ideal takes hold, and what the ancient world already called it.
Its fourth tab, the Watch, is a timeline of claims in circulation and the evidence for each.

**This is a record, not a verdict.** Movements are described in their own words and in published reporting.
Every quotation, event and claim carries its source and a flag for how it was checked. A claim on the Watch is not
a finding, and an unchecked claim is not false. The traditions' texts are set beside the movements as this
project's reading, never as proof. People who are not public figures are named by role only.

**How it was made.** The records were gathered, checked and worded with AI models made by Anthropic, which is
itself on this map. Each record went through a researcher, an independent checker who opened every source, a
curator, a second checker and adversarial reviewers. A person has not yet re-read every source. Corrections are
welcome: open an issue with the record and the source.

## Look at it

The site is published from this repository (Settings → Pages). To run it locally:

```bash
python3 build.py
python3 -m http.server -d site 8000
```

Then open http://localhost:8000. Or open `dist/ideals-map.html`, a single file with everything inside.

## Change it

- **The data** is in `data/`: ideals, carriers, vehicles, events (`fruits.json`), texts, funders, labs, evaluators,
  patterns, mechanisms, offshoots, links (`edges.json`) and the Watch (`watch.json`).
- **Validate** after any change: `python3 build.py --check`. It refuses a label in the map's own voice (cult,
  possessed, idolater and the like, outside quotation marks), a working note left in reader text, a Watch claim
  without who is speaking and its status, words read on a relay flagged as primary, and a link to a carrier's own
  sales or recruitment site.
- **A Watch entry** needs: `id`, `date`, `title` (neutral), `claimed_by`, `standing` (how the speaker stands to the
  matter), `claim` (their words), `source`, `url`, `kind` (claimed / reported / alleged / documented /
  first-person) and `status` (not checked / partly checked / checked / not supported / source not found). Then
  `checks` (what was looked for, where, the result, the flag), `responses`, `open` and `cautions`.
- **Test the viewer**: `python3 test/make_fixture.py && python3 build.py --data test/fixture --no-site --out
  dist/fixture.html && node test/smoke.js dist/fixture.html` (needs Node and Playwright).

## Publish it

**Vercel.** Import the repository at vercel.com/new. `vercel.json` sets the build (`python3 tools/package.py`),
the output folder (`dist/site`) and the security headers; there is nothing to choose. Every push to `main` redeploys,
and every pull request gets its own preview link. To let search engines in, add the environment variable
`PUBLIC` = `true` in the project's settings and redeploy. If you use Vercel, turn off GitHub Pages (or leave it
unset), so there is one public copy.

**GitHub Pages.** Pushing to `main` runs the workflow in `.github/workflows/pages.yml`: it validates the data, builds the site and
publishes it to GitHub Pages. The site is kept out of search engines until you set the repository variable
`PUBLIC` to `true` (Settings → Secrets and variables → Actions → Variables). Elsewhere, run
`python3 tools/package.py` and upload `dist/site/` to any static host (Netlify and Cloudflare Pages read its
`_headers` file).

## Licence

Not yet chosen.
