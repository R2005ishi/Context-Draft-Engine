// Word-level Levenshtein distance — counts word insertions, deletions, and
// substitutions needed to turn `a` into `b`. Used to measure how much a
// human editor changed a drafted changelog entry.
export function editDistance(a: string, b: string): number {
  const wordsA = a.trim().split(/\s+/).filter(Boolean);
  const wordsB = b.trim().split(/\s+/).filter(Boolean);

  const dp: number[][] = Array.from({ length: wordsA.length + 1 }, () =>
    new Array(wordsB.length + 1).fill(0)
  );

  for (let i = 0; i <= wordsA.length; i++) dp[i][0] = i;
  for (let j = 0; j <= wordsB.length; j++) dp[0][j] = j;

  for (let i = 1; i <= wordsA.length; i++) {
    for (let j = 1; j <= wordsB.length; j++) {
      dp[i][j] =
        wordsA[i - 1] === wordsB[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[wordsA.length][wordsB.length];
}
