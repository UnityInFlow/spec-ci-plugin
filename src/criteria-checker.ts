import { CriteriaMatch } from "./types.js";

export function extractCriteria(specContent: string): string[] {
  const criteriaRegex =
    /## Acceptance Criteria\s*\n([\s\S]*?)(?=\n## |$)/i;
  const match = specContent.match(criteriaRegex);
  if (!match) return [];

  return match[1]
    .split("\n")
    .map((line) => line.replace(/^[-*]\s+(?:\[.\]\s+)?/, "").trim())
    .filter((line) => line.length > 0);
}

export function extractTestDescriptions(testContent: string): string[] {
  const descriptions: string[] = [];
  const regex = /(?:describe|it|test)\s*\(\s*["'`](.*?)["'`]/g;

  for (const match of testContent.matchAll(regex)) {
    descriptions.push(match[1]);
  }

  return descriptions;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function fuzzyTokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  // Prefix match: "log" matches "login", "user" matches "users"
  if (a.length >= 3 && b.length >= 3) {
    if (a.startsWith(b) || b.startsWith(a)) return true;
  }
  return false;
}

function similarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let overlap = 0;
  for (const tokenA of setA) {
    for (const tokenB of setB) {
      if (fuzzyTokenMatch(tokenA, tokenB)) {
        overlap++;
        break;
      }
    }
  }

  return overlap / Math.max(setA.size, setB.size);
}

export function matchCriteria(
  criteria: string[],
  testFiles: Map<string, string[]>,
): CriteriaMatch[] {
  return criteria.map((criterion) => {
    let bestMatch = { score: 0, file: "", name: "" };

    for (const [file, descriptions] of testFiles) {
      for (const desc of descriptions) {
        const score = similarity(criterion, desc);
        if (score > bestMatch.score) {
          bestMatch = { score, file, name: desc };
        }
      }
    }

    const threshold = 0.3;
    if (bestMatch.score >= threshold) {
      return {
        criterion,
        matched: true,
        testFile: bestMatch.file,
        testName: bestMatch.name,
      };
    }

    return { criterion, matched: false };
  });
}
