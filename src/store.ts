// Edit memory (phase 4) + round history (phase 5): persists each
// draft/human-edit pair to disk, per repo, so future drafts can learn from
// past edits and the edit-distance trend can be measured across rounds.

import { promises as fs } from "fs";
import path from "path";

export interface EditRound {
  round: number;
  owner: string;
  repo: string;
  draft: string;
  editedDraft: string;
  editDistance: number;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data", "edits");

function fileFor(owner: string, repo: string): string {
  return path.join(DATA_DIR, `${owner}-${repo}.json`);
}

export async function loadRounds(owner: string, repo: string): Promise<EditRound[]> {
  try {
    const raw = await fs.readFile(fileFor(owner, repo), "utf-8");
    return JSON.parse(raw) as EditRound[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function appendRound(
  owner: string,
  repo: string,
  draft: string,
  editedDraft: string,
  editDistance: number
): Promise<EditRound> {
  const rounds = await loadRounds(owner, repo);
  const round: EditRound = {
    round: rounds.length + 1,
    owner,
    repo,
    draft,
    editedDraft,
    editDistance,
    createdAt: new Date().toISOString(),
  };
  rounds.push(round);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(fileFor(owner, repo), JSON.stringify(rounds, null, 2));
  return round;
}
