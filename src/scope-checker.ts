import { ScopeResult } from "./types.js";

export function extractDeclaredScope(specContent: string): string[] {
  const paths: string[] = [];

  // Extract from GSD <files> tags
  const xmlRegex = /<files>(.*?)<\/files>/gs;
  for (const match of specContent.matchAll(xmlRegex)) {
    paths.push(
      ...match[1]
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
    );
  }

  // Extract from ## Scope section
  const scopeRegex =
    /## (?:Scope|Files in scope)\s*\n([\s\S]*?)(?=\n## |$)/i;
  const scopeMatch = specContent.match(scopeRegex);
  if (scopeMatch) {
    const lines = scopeMatch[1].split("\n");
    for (const line of lines) {
      const cleaned = line.replace(/^[-*]\s+/, "").trim();
      if (cleaned.length > 0 && !cleaned.startsWith("#")) {
        paths.push(cleaned);
      }
    }
  }

  return [...new Set(paths)];
}

export function checkScopeCompliance(
  declaredScope: string[],
  changedFiles: string[],
): ScopeResult {
  // No declared scope = skip check (everything is in scope)
  if (declaredScope.length === 0) {
    return { compliant: true, declaredScope, changedFiles, outOfScope: [] };
  }

  const outOfScope = changedFiles.filter(
    (f) => !declaredScope.some((s) => f.startsWith(s)),
  );

  return {
    compliant: outOfScope.length === 0,
    declaredScope,
    changedFiles,
    outOfScope,
  };
}
