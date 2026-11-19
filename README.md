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

**For a newcomer:** the page opens with "Start with a name you know": a row of people and companies most readers
have heard of (`front_names` in `data/meta.json`; the check refuses a name that is not on the map). Each opens its
record **at a glance**: their own words from anywhere on the map, money in and out (one line each: when, from or to
whom, how much, never added up), what has happened and claims on the Watch, a few lines of each before the full
record. The plain page `r/<id>/` carries the same glance. Below come the ideals as cards: each gives the ideal's
name, one voice from its record (named, with its source and flag), who holds it and who answers it, and where it
stands in one plain sentence ("So far: … Partly: … Not yet: …", from each phase's `plain` words in
`data/phases.json`). **Checking marks** are short: a filled dot for checked at the source, half for checked on a
relay, a dashed ring for not checked, a ringed dot for re-read by a person. A tap shows the full words, screen
readers always hear them, and the plain record pages spell them out. "Show the ideals
as a drawing" switches to the linked map, with its key folded under "Key". "New here? Start here" holds the ways in
by where you are coming from, every part of the map, the words it uses and what each checking mark means.
**Timeline** lists every dated event and Watch claim, newest first. The search box finds any name, event or claim
and opens it where it lives. Every record and every Watch claim ends with a line to cite it.

**Every record has a page of its own.** A published copy carries `r/<id>/` for every ideal, person, group, event,
funder, company, evaluator, method, older text and Watch claim, and `r/` lists them all. Each page is
plain HTML with no script: the record's words, sources, flags and threads, a line to cite it, a way to reply, and a
link into the map. It is what a search, a shared link or an AI system reaches: its title, description and preview
image come from the record's own words (a page about someone leads with their own words where the map has them),
and it carries citation markup (schema.org, with no rating of any claim). `sitemap.xml` lists the pages search
engines may index and `llms-full.txt` gives the same records as plain text, every quotation with its speaker, source
and flag. `tools/pages.py` writes all of it; `tools/package.py` runs it.

**The re-read gate.** A claim on the Watch, an allegation or an offshoot stays out of search engines (noindex), out
of the sitemap and out of `llms-full.txt` until a person has re-read every page it cites; then it goes in on the
next build, by itself. Until then its page is published, can be shared and answered, and says it is waiting. Other
pages list it with no search snippet (`data-nosnippet`) and a `nofollow` link. `tools/package.py` prints how many wait.

**To follow it:** a published copy carries `feed.xml`, an Atom feed of the newest Watch claims and events
(`tools/feed.py`, run by `tools/package.py`). The header says when the data last changed.

**For researchers:** the published site carries the data under `data/`: `graph.json`, one CSV per table (with
quotations, phase conditions and the Watch's checks broken out), `sources.csv` (every cited page with its
re-read and link status) and `ideals-map-data.zip`. [DATA.md](DATA.md) documents every field. To write it
locally: `python3 tools/export_data.py` (into `dist/data/`).

## Check it

No person has yet re-read the sources; models did every step. These tools make that debt something to work down.

- **On a phone: `/reread.html` on the published site** (for example
  https://converge-olive-theta.vercel.app/reread.html). It shows one cited page at a time, Watch and allegations
  first: what the map takes from the page, a button to open it, and the automatic pre-check's result. Tap "It
  holds", "Doesn't hold" (with a note) or "Can't read". Answers are kept on the phone. "Save to the map" opens
  GitHub's new-file page with them filled in, into `data/reread-inbox/`; tap Commit changes, and the next deploy
  merges them into the ledger (`tools/sources.py`) and shows them as re-read by a person. A broken file there is
  skipped with a warning, never a failed deploy. The page needs `repo` in `data/meta.json`; the pre-check it shows
  is `data/precheck.json` (refresh with `python3 tools/precheck.py --save`).

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

- **Replies from the people on the map.** Every record about a party (everything but the old texts, patterns and
  mechanisms) and every Watch claim asks "Is this about you, or a group you speak for?" and links the reply form
  (`.github/ISSUE_TEMPLATE/reply.yml`) with the record filled in. A reply goes under the record's `responses` (or
  `words`) in the replier's own words once it is confirmed to come from them: `primary` when the same words are on
  their own page, otherwise `secondary` with a caution saying how it was confirmed.
- **Claims and corrections** come in as issues: the forms in `.github/ISSUE_TEMPLATE/` ask for the exact words,
  who said them, a link and the date, and refuse private names. Set `contribute` in `data/meta.json` to the
  repository's new-issue page once it is public (for example `https://github.com/OWNER/REPO/issues/new/choose`):
  Start here will offer it, and every record and Watch claim gets a "Reply to this record or correct it" link that
  opens the correction form with the record filled in. Set `site_url` to the published address so citations and
  the feed carry full links.

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
  Claims that belong together (one day's outage reports, say) can share a `thread`: describe it once in
  `data/meta.json` under `watch_threads` with a neutral `title` and a `note` on why the claims are here, and the
  Watch shows them together, folded, under that note.
- **An ideal's card** shows its first quotation. Where that is not a voice for the ideal (a critic, say), set `lead`
  to the index of the one to show instead; the speaker is always named.
- **Preview images** (`site/cards/`): one for the site and one per ideal, drawn by `python3 tools/cards.py` (needs
  Node and Playwright, so the images are kept in the repository). `cards.json` records the words each was drawn from;
  when an ideal's name, statement or lead quotation changes, its image stops being used (the site's image stands in)
  until you run `tools/cards.py` again.
- **Test the viewer**: `python3 test/make_fixture.py && python3 build.py --data test/fixture --no-site --out
  dist/fixture.html && node test/smoke.js dist/fixture.html` (needs Node and Playwright), then
  `python3 test/pages.py dist/fixture.html` for the plain pages (Python only). The phone re-read page:
  `python3 tools/package.py && node test/reread.js dist/site`.

## Publish it

The host builds the site itself from this repository, so publishing does not depend on GitHub Actions. (Actions
cannot start jobs on this repository at the moment: every run, even a one-line test, fails within seconds with no
log, which points to the account's billing or Actions minutes. The workflows below are ready for when it can.)
The build command validates the data first (`python3 tools/package.py` runs `build.py`), so a record that breaks
a guardrail stops the deploy.

**Public now, as a draft.** `"public": true` in `data/meta.json` makes every build indexable and labels the map a
draft, with no host setting to change; set it to `false` to go back to noindex. While a person has not finished
re-reading the pages behind the Watch and the allegations, the header says so and gives the count, and each Watch
claim says whether its sources have been re-read. Feedback goes to the issue forms (`contribute`).

**Vercel (connected).** The repository is connected to Vercel, which builds from `vercel.json`: every push to
`main` publishes the site and every pull request gets a preview address (behind a Vercel login, so only the
account sees it). Vercel's build is also the check that runs on every push while Actions cannot: a record that
breaks a guardrail fails the deploy. To let search engines in, add the environment variable `PUBLIC` = `true` in
the project's settings and redeploy. A password on the production site is a paid feature there.

**Cloudflare Pages (an alternative).** Free with no bandwidth cap, it applies the `_headers` file, and Cloudflare
Access can put a free email login in front of the production site. Workers & Pages → Create → Pages → Connect to
Git, choose this repository, build command `python3 tools/package.py`, output directory `dist/site`, production
branch `main`, no framework preset. For a login: Zero Trust → Access → Applications → a self-hosted application
for the site's address, letting in only the emails you choose.

**GitHub Pages** needs Actions and, on a private repository, a paid plan; it also ignores `_headers`. **Any static
host:** run `python3 tools/package.py` and upload `dist/site/`.

**From GitHub Actions instead** (once Actions can run): `.github/workflows/pages.yml` also drives the viewer in a
browser on every push and pull request, and can upload to Cloudflare Pages itself. Set the variable `CLOUDFLARE` =
`true` and the secrets `CLOUDFLARE_API_TOKEN` (permission: Account → Cloudflare Pages → Edit) and
`CLOUDFLARE_ACCOUNT_ID`, and use a project made with "upload directly" rather than "Connect to Git".

**Checked every week.** `.github/workflows/sources.yml` runs the link check and the quote pre-check each Monday,
keeps the reports as a download on the run's page, and fails (so GitHub emails the owner) when a cited page is
gone. Until Actions can run, run `python3 tools/links.py` and `python3 tools/precheck.py` by hand or from a session.

## Tell the people on it

`python3 tools/notify.py` writes `dist/notify.md` (not published): for each public figure, group, company, funder
and evaluator with a page, those that Watch claims touch first, the page's address and a short draft note inviting a
reply, with the disclosure from `data/meta.json`. It sends nothing; contact addresses are not in the data. Sending
is outreach to bodies on the map, so update the disclosure when the first note goes out.

**A domain.** Every absolute address (canonical links, preview images, the sitemap, the feed, citations) comes from
`site_url` in `data/meta.json`. To move to a domain of your own, point it at the host and change that one line.

## Licence

Code: MIT (`LICENSE`). Data and the map's own text: CC BY 4.0 (`LICENSE-DATA.md`). Quoted words belong to their
authors and are not covered.
