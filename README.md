# Context Draft Engine

A system that drafts changelog entries from noisy multi-source GitHub
activity (commits, PRs, issues) and learns from human edits over successive
rounds. Built as a demo for Manicule's Engineering Intern role.

## The idea

Writing changelogs from raw engineering activity is repetitive, and a lot of
what makes one good is implicit editorial judgment — what to group, what to
skip, how terse to be. Rather than trying to encode that judgment upfront,
this project has an LLM draft the changelog, has a human edit it, and feeds
that edit back into the next draft as a worked example. Over a few rounds on
the same repo, drafts should need less and less correction.

## How it works

```
GitHub API → RepoContext → LLM draft → human edit (UI) → logged round
                 ↑                                            │
                 └──────── fed back as few-shot examples ──────┘
```

1. **Ingest** — pull recent commits, PRs, and issues for a public repo from
   the GitHub REST API.
2. **Draft** — send that context to an LLM (via OpenRouter) with a changelog
   -writing prompt, get back a draft.
3. **Review** — a human edits the draft in a browser UI.
4. **Remember** — the (draft, edit) pair is logged. The _next_ draft for that
   repo includes recent past edits as few-shot examples, so the model can
   pick up on the editor's recurring preferences.
5. **Measure** — word-level edit distance between each draft and its edited
   version is tracked per round, so the learning effect is visible rather
   than assumed.

## Setup

```bash
npm install
cp .env.example .env
# GITHUB_TOKEN: optional, raises GitHub API rate limit 60/hr -> 5000/hr
# OPENROUTER_API_KEY: required for draft generation, get one at
#   https://openrouter.ai/keys
```

## Run

```bash
npm run dev
```

Then either use the UI or hit the API directly.

**UI** (http://localhost:3000):

- `/review.html` — fetch a draft for a repo, edit it, save the round
- `/trend.html` — line chart + table of edit distance per round

**API**:

- `GET /api/context/:owner/:repo?limit=10` — raw ingested context
- `GET /api/draft/:owner/:repo?limit=10` — generates a changelog draft,
  folding in that repo's past edits as few-shot examples
- `POST /api/edits/:owner/:repo` `{ draft, editedDraft }` — logs a human
  edit, computes edit distance, returns the logged round
- `GET /api/trend/:owner/:repo` — logged rounds' edit distances

**Standalone scripts** (no server needed):

```bash
npm run test:ingest -- colinhacks zod   # ingestion only
npm run test:draft  -- colinhacks zod   # ingestion + draft, prints the draft
```

To reproduce a trend: open `/review.html`, fetch → edit for real → save,
repeat 2-3 times on the same repo, then check `/trend.html`. Edit history is
stored per-repo in `data/edits/<owner>-<repo>.json`.

## Project structure

```
src/
  github.ts         ingestion — fetches and shapes GitHub API data
  draft.ts           draft generation via OpenRouter, folds in edit memory
  store.ts           persists edit rounds to data/edits/
  edit-distance.ts   word-level Levenshtein distance
  server.ts          Express app exposing the API above
  test-ingest.ts     standalone ingestion test script
  test-draft.ts      standalone draft generation test script
public/
  review.html        draft review + edit-logging UI
  trend.html         edit-distance trend chart
data/
  edits/             per-repo (draft, edit, distance) history — the model's memory
```

## Known limitations

- **Draft quality**: the model (`openai/gpt-4o-mini` via OpenRouter)
  sometimes describes open/unmerged PRs as if they'd already shipped —
  the prompt asks it to trace every claim to the given context, but doesn't
  yet enforce open-vs-merged distinctions. Worth tightening before trusting
  drafts unreviewed.
- **One repo's worth of evidence**: the trend above is from a single 3-round
  run on one repo. A flat edit distance after round 1 is a good sign but
  could also mean the round-2 edit was just smaller to begin with — more
  rounds and more repos would make the trend more convincing.
- **No automated tests** — correctness has been verified by manual runs
  (`npm run test:ingest`, `npm run test:draft`, the UI flows) rather than a
  test suite.
