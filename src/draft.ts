// Draft generator (phase 2): takes the shaped RepoContext from ingestion
// and asks a model to draft a changelog entry from it. All the judgment
// about what's worth mentioning happens in the prompt, not here.

import type { RepoContext } from "./github.js";

const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";
const DRAFT_MODEL = "openai/gpt-4o-mini";

const SYSTEM_PROMPT = `You are a technical writer drafting a changelog entry from raw engineering
activity: commit messages, pull request titles and descriptions, and issue
reports.

A human editor will review and edit your draft before it's published. Your
job is to get as close to publish-ready as possible on the first pass.

Rules:
- Every claim must trace back to something literally present in the
  provided context. Never invent features, dates, or details that aren't
  there.
- Write for a developer audience: specific and technical, no marketing
  language ("blazing fast", "seamless", "game-changing", "revolutionary").
- Group related changes together instead of listing every commit
  chronologically.
- Skip trivial activity (typo fixes, CI config, formatting-only commits)
  unless it's the only activity in the window.
- Keep it under 200 words unless the volume of real changes genuinely
  requires more.
- Output only the changelog entry itself. No preamble, no "Here's the
  changelog:", no closing remarks.`;

function formatContext(context: RepoContext): string {
  const lines: string[] = [];

  lines.push(`Repository: ${context.owner}/${context.repo}`);

  lines.push(`\nCommits:`);
  for (const c of context.commits) {
    lines.push(`- ${c.sha.slice(0, 7)}: ${c.message.split("\n")[0]}`);
  }

  lines.push(`\nPull requests:`);
  for (const p of context.pullRequests) {
    lines.push(`- #${p.number} [${p.state}] ${p.title}`);
    if (p.body) lines.push(`  ${p.body.slice(0, 500)}`);
  }

  lines.push(`\nIssues:`);
  for (const i of context.issues) {
    lines.push(`- #${i.number} [${i.state}] ${i.title}`);
    if (i.body) lines.push(`  ${i.body.slice(0, 500)}`);
  }

  return lines.join("\n");
}

export interface PastEdit {
  draft: string;
  editedDraft: string;
}

function buildSystemPrompt(pastEdits: PastEdit[]): string {
  if (pastEdits.length === 0) return SYSTEM_PROMPT;

  // Few-shot from edit memory (phase 4): show the model its own past drafts
  // next to how a human editor actually revised them, so it can pick up on
  // the editor's recurring preferences instead of repeating the same edits.
  const examples = pastEdits
    .slice(-3)
    .map(
      (r, i) =>
        `Example ${i + 1} — your previous draft:\n${r.draft}\n\nHuman editor's revision:\n${r.editedDraft}`
    )
    .join("\n\n---\n\n");

  return `${SYSTEM_PROMPT}

Below are examples of past drafts you wrote and how a human editor revised
them. Learn from these edits — match the editor's style, terminology, and
judgment about what to include or cut in future drafts.

${examples}`;
}

/**
 * Sends the ingested context to an LLM (via OpenRouter) and returns a
 * drafted changelog entry as plain text. `pastEdits` (phase 4 edit memory)
 * are included as few-shot examples so the draft trends toward the human
 * editor's preferences over successive rounds.
 */
export async function generateDraft(
  context: RepoContext,
  pastEdits: PastEdit[] = []
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const res = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DRAFT_MODEL,
      messages: [
        { role: "system", content: buildSystemPrompt(pastEdits) },
        { role: "user", content: formatContext(context) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as any;
  const draft = data.choices?.[0]?.message?.content;
  if (!draft) {
    throw new Error(`OpenRouter response missing draft content: ${JSON.stringify(data)}`);
  }

  return draft as string;
}
