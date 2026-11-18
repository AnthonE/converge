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

**For a newcomer:** "New here? Start here" under the title explains the map in plain words, the five ways in,
the words it uses and what each checking mark means. **Timeline** lists every dated event and Watch claim, newest
first. The search box finds any name, event or claim and opens it where it lives.

**For researchers:** the published site carries the data under `data/`: `graph.json`, one CSV per table (with
quotations, phase conditions and the Watch's checks broken out), `sources.csv` (every cited page with its
re-read and link status) and `ideals-map-data.zip`. [DATA.md](DATA.md) documents every field. To write it
locally: `python3 tools/export_data.py` (into `dist/data/`).

## Check it

No person has yet re-read the sources; models did every step. Two tools make that debt something to work down:

- `python3 tools/reread.py` writes `dist/reread.md`: every cited page (373 now) in the order to read it, the
  Watch first, then allegations, then anything no model checked, then relays, then pages read at the source.
  One reading covers every item that cites the page. After opening a page and comparing it with the map, record
  it: `python3 tools/reread.py mark URL holds` (or `corrected`, `removed`, `"could not read"`). This writes
  `data/reread.json`; the viewer then shows "re-read by a person" beside the machine's flag, and Start here
  shows the count.
- `python3 tools/review.py` does the same in a browser, one page at a time: it shows what the map takes from the
  page and what the automatic pre-check found, and saves each answer (`holds`, `does not hold` with a note,
  `could not read`) to `data/reread.json`. Run `python3 tools/precheck.py` first: it looks for every quoted
  passage on its page, so a reading where every word was found is a quick look at the context. A match is never
  counted as a person's reading.
- `python3 tools/links.py` checks that every cited page still answers and writes `dist/links.md` (read-only;
  `gone` means 404, 410 or no such host; `refused` means the site turned away an automated check). Archiving the
  live pages in the Wayback Machine is left to the operator, because it sends each address to the Internet Archive.

## Change it

- **Claims and corrections** come in as issues: the forms in `.github/ISSUE_TEMPLATE/` ask for the exact words,
  who said them, a link and the date, and refuse private names. Set `contribute` in `data/meta.json` to the
  repository's new-issue page once it is public, and Start here will offer it.

- **The data** is in `data/`: ideals, carriers, vehicles, events (`fruits.json`), texts, funders, labs, evaluators,
  patterns, mechanisms, offshoots, links (`edges.json`) and the Watch (`watch.json`).
- **Validate** after any change: `python3 build.py --check`. It refuses a label in the map's own voice (cult,
  possessed, idolater and the like, outside quotation marks), a working note left in reader text, a Watch claim
  without who is speaking and its status, words read on a relay flagged as primary, and a link to a carrier's own
  sales or recruitment site.
- **A Watch entry** needs: `id`, `date`, `title` (neutral), `claimed_by`, `standing` (how the speaker stands to the
  matter), `claim` (their words), `source`, `url`, `kind` (claimed / reported / alleged / documented /
  first-person) and `status` (not checked / partly checked / checked / not supported / source not found). Then
  `checks` (what was looked for, where, the result, the flag), `responses`, `open` and `cautions`. Optional: `why`
  (one line on why the entry is on the map) and `travelled`, the claim's path from source to source, oldest first:
  each step has `date`, `who`, `said` (their exact words), `source`, and where it can `url`, `verified` and `cites`
  (what it gives as its source); every step after the first says in `changed`, neutrally, what it added or dropped.
- **Test the viewer**: `python3 test/make_fixture.py && python3 build.py --data test/fixture --no-site --out
  dist/fixture.html && node test/smoke.js dist/fixture.html` (needs Node and Playwright).

## Publish it

The host builds the site itself from this repository, so publishing does not depend on GitHub Actions. (Actions
cannot start jobs on this repository at the moment: every run, even a one-line test, fails within seconds with no
log, which points to the account's billing or Actions minutes. The workflows below are ready for when it can.)
The build command validates the data first (`python3 tools/package.py` runs `build.py`), so a record that breaks
a guardrail stops the deploy.

**Cloudflare Pages (recommended).** Free for a static site with no bandwidth cap, it applies the `_headers` file
the package writes (the security headers), and Cloudflare Access can put an email login in front of the site
while it is private. One-time setup:

1. Workers & Pages → Create → Pages → Connect to Git, and choose this repository (Cloudflare asks to install its
   GitHub app on it).
2. Build command `python3 tools/package.py`, build output directory `dist/site`, production branch `main`. No
   framework preset.
3. To keep it private: Zero Trust → Access → Applications → add a self-hosted application for the site's
   address, with a policy that lets in only the emails you choose.

Every push to `main` then publishes the site, and every pull request gets its own preview address. To let search
engines in, add the environment variable `PUBLIC` = `true` in the project's settings and redeploy.

**Vercel** builds the same way from `vercel.json` (import the repository at vercel.com/new); a password on the
site is a paid feature there. **GitHub Pages** needs Actions and, on a private repository, a paid plan; it also
ignores `_headers`. **Any static host:** run `python3 tools/package.py` and upload `dist/site/`.

**From GitHub Actions instead** (once Actions can run): `.github/workflows/pages.yml` also drives the viewer in a
browser on every push and pull request, and can upload to Cloudflare Pages itself. Set the variable `CLOUDFLARE` =
`true` and the secrets `CLOUDFLARE_API_TOKEN` (permission: Account → Cloudflare Pages → Edit) and
`CLOUDFLARE_ACCOUNT_ID`, and use a project made with "upload directly" rather than "Connect to Git".

**Checked every week.** `.github/workflows/sources.yml` runs the link check and the quote pre-check each Monday,
keeps the reports as a download on the run's page, and fails (so GitHub emails the owner) when a cited page is
gone. Until Actions can run, run `python3 tools/links.py` and `python3 tools/precheck.py` by hand or from a session.

## Licence

Code: MIT (`LICENSE`). Data and the map's own text: CC BY 4.0 (`LICENSE-DATA.md`). Quoted words belong to their
authors and are not covered.
