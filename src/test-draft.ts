import "dotenv/config";
import { fetchRepoContext } from "./github.js";
import { generateDraft } from "./draft.js";

const [owner = "colinhacks", repo = "zod"] = process.argv.slice(2);

const context = await fetchRepoContext(owner, repo, 5);
console.log(`Fetched context for ${owner}/${repo} at ${context.fetchedAt}\n`);

const draft = await generateDraft(context);
console.log(draft);
