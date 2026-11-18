# CLAUDE.md: converge (the Ideals Map)

A public record of what the movements around AI say they serve: who carries each ideal, what it runs on, what has
happened, who pays and who evaluates, how each ideal takes hold, what the ancient texts already called it, and the
Watch, a timeline of claims in circulation and the evidence for each. `README.md` has the layout and the commands.

## The rule above the others: a record, not a verdict

The operator: "we're not here to force a conclusion. we're just showing the timeline and the evidence. we are not
the judge." Every record says who is speaking, quotes them, gives the source and says how it was checked. The map's
own voice never labels anyone (cult, possessed, idolater, groomer and the like); a label appears only inside a quote,
attributed. An unchecked claim is not false, and a claim on the Watch is not a finding.

## Before you commit

- Run `python3 build.py --check`. It must pass. It refuses labels in the map's own voice, working notes in reader
  text (TODO, "per the checker", "dossier" and the like), relayed words flagged as primary, Watch entries without
  who is speaking and a status, duplicate ids and links to a carrier's own sales or recruitment site.
- If you touched `site/`, also run the browser test (README, "Test the viewer").
- Commit and push to `main` only when the operator asks; otherwise use a branch and a pull request.

## Checking and flags

- `verified: primary` only when the words were read on the speaker's own page (their site, post, filing, paper).
  Interviews, transcripts, coverage, screenshots and relays are `secondary`. Not read at all: `none`.
- Open every source before citing it. Quote exactly; never paraphrase inside quotation marks. Read the claim's own
  wording against the source and record a mismatch in `cautions` (the Red Means No entry shows how).
- Search for the other side and record it under `responses`: the subject's reply, a correction, a retraction, the
  account of the people affected. Record what is still unknown under `open`.
- Where a claim has been passed along, trace it under `travelled`: each step's exact words and what it gives as its
  source, oldest first, and what changed from the step before (a hedge dropped, a number added). Say what changed;
  do not say who is right. Anonymous posts can be a step, by role, unlinked; never use one as evidence.
- A tradition's text beside a movement is this project's reading, labelled as such. It never proves anything about
  the movement, and nothing here says any text foretold anyone.

## People

- Public figures are named in their public role. Everyone else (members, attendees, victims, defendants, private
  accusers, the people affected) is named by role only, for example "a woman who says she was affected (a private
  person, not named here)". Do not link a page that would name them unless they published it themselves to be read
  on this matter, and even then name them by role.
- No one's private life goes on the map unless it is the matter itself (an alleged harm, a business, a public claim).
- Deaths by suicide: no names of the deceased, no methods, mark links the sources do not support, include a crisis
  line (988 in the US).

## Conflicts

The records were gathered and worded with AI models made by Anthropic, which is itself on the map. Say so wherever
Anthropic or its models are a party, and do not soften results about them. The disclosure line in `data/meta.json`
is a draft until the operator writes it.

## Where the research lives

The research record (researchers' dossiers, checkers' verdicts, the private name list, the import tools) stays in
the operator's private research repository and is never copied here. New entries here are written by hand into
`data/`, under the rules above.
