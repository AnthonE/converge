# The Ideals Map: the data

What the movements around AI say they serve, who carries each ideal, what has happened, who pays and who
evaluates, how each ideal takes hold, what older traditions called it, and claims in circulation (the Watch).
This file describes every table and field so the records can be used outside the viewer.

**A record, not a verdict.** Each row says who is speaking or what the source is, and how it was checked. A claim
on the Watch is not a finding. An unchecked claim is not false. A dotted ("lens") link is this project's reading,
not a finding. A record of money is not a finding about anyone's work or motive. Amounts are as each source states
them; do not add them up, because some are pledges, recommendations or totals over years.

**How it was made.** The records were gathered, checked and worded with AI models made by Anthropic, which is
itself on the map (as an evaluated company, a funder and a party to a reported dispute). `sources.csv` shows, for
every cited page, whether a person has re-read it yet. Until that count is high, treat every row as a lead.

**Licence.** CC BY 4.0 for the data and the map's own text (see `LICENSE-DATA.md` in the repository). Quoted
words belong to their authors and are not covered.

## Files

| File | One row per |
|---|---|
| `graph.json` | everything below in one file, as the viewer reads it |
| `ideals.csv` | ideal: an end a movement says it serves |
| `phase_conditions.csv` | condition under one of an ideal's six phases |
| `carriers.csv` | movement, organisation, community, product, venue or public figure |
| `vehicles.csv` | made thing an ideal runs on (a model, an app, a forum, a token) |
| `fruits.csv` | event, with date and source |
| `texts.csv` | older text (KJV unless said otherwise) |
| `funders.csv`, `labs.csv`, `evaluators.csv` | funder; AI company; body that tests, ranks or scores |
| `patterns.csv` | ancient pattern (what older traditions called it) |
| `mechanisms.csv` | mechanism named in scholarship (how an ideal takes hold) |
| `offshoots.csv` | group that came out of a community on the map; public record only |
| `quotes.csv` | quotation in a speaker's own words, under its owner |
| `edges.csv` | link between two ids |
| `watch.csv`, `watch_checks.csv`, `watch_responses.csv` | claim in circulation; each check made on it; each response on the record |
| `watch_travelled.csv` | step in how a claim was passed along, oldest first |
| `sources.csv` | cited page (URL), with its re-read and link status |
| `meta.json` | title, notes, the author's disclosure (a draft), hosts that are named but never linked |

## Fields that recur

- **`id`**: stable, lower-case, unique across the whole map. `from` and `to` in `edges.csv`, `owner_id`,
  `ideal_id`, `watch_id` and `touches` refer to it.
- **`verified`**: how a model checked the words or the fact. `primary` = read on the speaker's own page (their
  site, post, filing, paper). `secondary` = read only in an interview, transcript, news story, relay or
  screenshot. `unverified` = not checked. No value = a reading or a summary, which carries no flag.
- **`kind`** (events, money links, offshoot records): `documented` = a record shows it; `reported` = the press
  says so; `alleged` = someone accuses and nothing is decided. An allegation is never drawn as a line.
- **`nolink`**: `true` when the URL is a carrier's own sales or recruitment page. The viewer names it and does
  not link it. Hosts treated this way are listed in `meta.json` under `nolink_hosts`.
- **`date`**: `YYYY`, `YYYY-MM` or `YYYY-MM-DD`, as precise as the source allows.
- **`cautions`**, **`open`**: what to keep in mind, and what is still unknown. Read them before quoting a row.

## Tables

**ideals**: `label` (the map's own short name), `ideal` (the end, stated as its carriers state it), `summary`,
`field_key` (five questions answered: how did it come, does it speak, does it survive your silence, how many
independent channels, who stands outside), `cautions`.

**phase_conditions**: `phase` 0 to 5 (spoken, gathered, voiced, acting, housed, gated; see `graph.json` →
`phases`), `text` (the condition), `status` (`met`, `partly`, `not_met`, `unknown`), `evidence`, `url`. A phase
turns on conditions, never on a date. None of this is a forecast.

**carriers**: `kind` (movement, organization, community, public figure, discourse, product, venue), `status`
(free text, as of the date given), `note` (written from the records; not separately checked), `historical`
(`true` for a forebear whose own events are not drawn under today's carriers).

**fruits** (events): `label`, `what`, `kind`, `source`, `url`, `verified`.

**funders / labs / evaluators**: `kind` (funders), `note`, `policy` (an evaluator's stated rule on funding, in its
words), `disputes` (reported disputes, each with date, what, source and status; JSON).

**patterns**: `summary` (what the tradition saw), `sources` (each with tradition, work, passage, translation,
quote, url; JSON), `texts` (ids in `texts.csv`), `counter` (where the tradition itself pushes back; JSON),
`corpus` (pages in the project's wiki that treat the pattern).

**mechanisms**: `definition`, `scholarship` (author, title, year, url, claim, verified; JSON), `cautions`.

**offshoots**: `status` (where its matters stand, in words), `record` (dated matters, each with `kind`, a
`status` of charged, pending, decided, unknown or historical, and its source; JSON), `why_not` (why it is not an
ideal). No defendant, victim, member or private person
is named.

**quotes**: `owner_file`, `owner_id`, `speaker`, `quote` (exact, at most 160 characters), `source`, `url`,
`date`, `verified`, `nolink`.

**edges**: `edge_index` (position in `edges.json`; not stable across releases), `from`, `type`, `to`,
`sentence` (the link as a plain sentence), `lens` (`true` = a way of reading, not a finding), `limit` (where the
likeness stops), and for records `kind`, `amount`, `date`, `source`, `url`, `verified`. Types:

| Type | Reads as |
|---|---|
| `carries` | a carrier states or works for an ideal |
| `runs_on`, `speaks_for` | an ideal or carrier runs on a vehicle; a vehicle speaks for it |
| `bears_fruit` | an event belongs to an ideal, carrier or vehicle |
| `descends_from` | a documented lineage; `resembles` is likeness only |
| `parallels` | an older text set beside an ideal (always a lens) |
| `opposes`, `fed_by`, `starved_by`, `captures` | as named |
| `funds`, `hosts`, `evaluates` | a record of money (gift, grant, investment, loan, pledge, commission); hosting or running; testing or scoring |
| `invokes` | a carrier uses an ancient name in its own words (`speaker`, `quote`, `sense`: sincere, ironic, metaphor, unclear) |
| `reads_as` | this project's reading of an ideal or mechanism as an ancient pattern (a lens, with `limit`) |
| `uses` | a recorded use of a mechanism |
| `breaks_from` | an offshoot came out of a carrier's or vehicle's milieu |

**watch**: `date`, `title` (neutral), `claimed_by`, `standing` (how the speaker stands to the matter), `claim`
(their words), `source`, `url`, `kind` (claimed, reported, alleged, documented, first-person), `status` (not
checked, partly checked, checked, not supported, source not found), `why` (why it is on the Watch), `open`,
`cautions`, `touches` (ids on the map), `travelled_summary`. **watch_travelled**: `step` (1 = oldest), `date`,
`who`, `said` (their exact words), `source`, `url`, `verified`, `cites` (what that step gave as its source),
`changed` (what changed from the step before), `scores` (hedges, attribution and label, as coded; JSON).
**watch_checks**: `what` (what was looked for and what the page said), `result` (supports, partly supports, does
not support, not found, could not read), `source`, `url`, `verified`. **watch_responses**: `who`, `what`,
`source`, `url`.

**sources**: `url`, `host`, `items` (how many rows cite it), `cited_by` (`file:id` list), `tier` (1 = on the
Watch, 2 = allegations and court matters, 3 = no model checked, 4 = a model read it on a relay only, 5 = a model
read it at the source), `machine_flags`, `reread_result` and `reread_date` (a person opened the page and compared
it with the map: `holds`, `does not hold` (to be fixed), `corrected`, `removed`, `could not read`; empty = not yet), `link_status` (`ok`, `gone`,
`refused` = the site turned away an automated check, `error`) and `link_code`, as of the last link check.

## What is not here

The research record (researchers' notes, checkers' verdicts, the private name list) is kept apart and is not
published. The search went topic by topic and is not a full account of anyone's funders or carriers: the absence
of a row means only that this search drew no record.

## Corrections

Corrections and new claims are welcome: say which `id`, what the source says, and give its URL. Do not name
private people.
