# Context Draft Engine

A system that drafts content from noisy multi-source context (commits, PRs,
issues) and learns from human edits over successive rounds. Built as a
demo for Manicule's Engineering Intern role.

## Status: phases 1-4 complete, phase 5 needs real edit rounds

Ingests GitHub activity, drafts a changelog entry from it via an LLM, lets a
human edit the draft in a browser UI, and logs each edit so future drafts for
the same repo learn from past edits. What's left is actually running a few
rounds of real edits so the edit-distance trend has data to show.

## Setup

```bash
npm install
cp .env.example .env
# GITHUB_TOKEN: optional, raises rate limit 60/hr -> 5000/hr
# OPENROUTER_API_KEY: required for draft generation (phase 2+), get one at
#   https://openrouter.ai/keys
```

## Run

Start the server:

```bash
npm run dev
```

- `GET /api/context/:owner/:repo?limit=10` — raw ingested context (phase 1)
- `GET /api/draft/:owner/:repo?limit=10` — generates a changelog draft from
  that context, folding in this repo's past edit rounds as few-shot examples
  (phases 2 + 4)
- `POST /api/edits/:owner/:repo` `{ draft, editedDraft }` — logs a human edit,
  computes word-level edit distance, returns the logged round (phase 3)
- `GET /api/trend/:owner/:repo` — logged rounds' edit distances, for
  plotting (phase 5)
- `/review.html` — UI: fetch a draft, edit it in a textarea, save the round
- `/trend.html` — UI: line chart of edit distance per round, plus a table

Standalone scripts (no server needed):

```bash
npm run test:ingest -- colinhacks zod   # phase 1 only
npm run test:draft  -- colinhacks zod   # phases 1 + 2, prints the draft
```

## Measuring the trend (phase 5)

To actually see the edit-distance trend drop, run a few real rounds on the
same repo:

1. Open `/review.html`, fetch a draft for a repo, make real edits, save.
2. Repeat 2-3 times for the *same* repo — each round's draft is generated
   using the previous rounds' edits as few-shot examples.
3. Open `/trend.html` for that repo to see edit distance per round.

Edit history is stored per-repo in `data/edits/<owner>-<repo>.json`.

## Project structure

```
src/
  github.ts         ingestion — fetches and shapes GitHub API data (phase 1)
  draft.ts           draft generation via OpenRouter, folds in edit memory (phases 2 + 4)
  store.ts           persists edit rounds to data/edits/ (phases 3-5)
  edit-distance.ts   word-level Levenshtein distance
  server.ts          Express app — see endpoints above
  test-ingest.ts     standalone ingestion test script
  test-draft.ts      standalone draft generation test script
public/
  review.html        draft review + edit-logging UI (phase 3)
  trend.html         edit-distance trend chart (phase 5)
```
