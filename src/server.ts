import "dotenv/config";
import path from "path";
import express from "express";
import { fetchRepoContext } from "./github.js";
import { generateDraft } from "./draft.js";
import { loadRounds, appendRound } from "./store.js";
import { editDistance } from "./edit-distance.js";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "Context Draft Engine",
    ui: { review: "/review.html", trend: "/trend.html" },
  });
});

// GET /api/context/:owner/:repo?limit=10
app.get("/api/context/:owner/:repo", async (req, res) => {
  const { owner, repo } = req.params;
  const limit = req.query.limit ? Number(req.query.limit) : 10;

  try {
    const context = await fetchRepoContext(owner, repo, limit);
    res.json(context);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/draft/:owner/:repo?limit=10
// Draft generation feeds this repo's past edit rounds (phase 4 edit memory)
// back in as few-shot examples, so drafts should trend toward the editor's
// preferences the more rounds have been logged.
app.get("/api/draft/:owner/:repo", async (req, res) => {
  const { owner, repo } = req.params;
  const limit = req.query.limit ? Number(req.query.limit) : 10;

  try {
    const [context, pastRounds] = await Promise.all([
      fetchRepoContext(owner, repo, limit),
      loadRounds(owner, repo),
    ]);
    const draft = await generateDraft(context, pastRounds);
    res.json({ context, draft, round: pastRounds.length + 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/edits/:owner/:repo  { draft, editedDraft }
// Logs a human edit of a draft (phase 3) — computes edit distance and
// appends the round to this repo's edit history (phases 4 + 5).
app.post("/api/edits/:owner/:repo", async (req, res) => {
  const { owner, repo } = req.params;
  const { draft, editedDraft } = req.body ?? {};

  if (typeof draft !== "string" || typeof editedDraft !== "string") {
    res.status(400).json({ error: "Request body must include draft and editedDraft strings" });
    return;
  }

  try {
    const distance = editDistance(draft, editedDraft);
    const round = await appendRound(owner, repo, draft, editedDraft, distance);
    res.json(round);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/trend/:owner/:repo
// Returns the logged rounds' edit distances (phase 5), for plotting how
// much human editing each successive draft required.
app.get("/api/trend/:owner/:repo", async (req, res) => {
  const { owner, repo } = req.params;

  try {
    const rounds = await loadRounds(owner, repo);
    res.json(
      rounds.map((r) => ({
        round: r.round,
        editDistance: r.editDistance,
        createdAt: r.createdAt,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(port, () => {
  console.log(`Context Draft Engine listening on http://localhost:${port}`);
});
