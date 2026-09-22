import "dotenv/config";
import { fetchRepoContext } from "./github.js";

const [owner = "colinhacks", repo = "zod"] = process.argv.slice(2);

const context = await fetchRepoContext(owner, repo, 5);

console.log(`\nFetched context for ${owner}/${repo} at ${context.fetchedAt}\n`);

console.log(`Commits (${context.commits.length}):`);
for (const c of context.commits) {
  console.log(`  - ${c.sha.slice(0, 7)} ${c.message.split("\n")[0]}`);
}

console.log(`\nPull requests (${context.pullRequests.length}):`);
for (const p of context.pullRequests) {
  console.log(`  - #${p.number} [${p.state}] ${p.title}`);
}

console.log(`\nIssues (${context.issues.length}):`);
for (const i of context.issues) {
  console.log(`  - #${i.number} [${i.state}] ${i.title}`);
}
