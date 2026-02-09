export function normalizeSearchToken(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[#@.,;:!?"'`~()\[\]{}<>/\\|+=*^$%&_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length < 2) return null;
  return normalized;
}

export function buildSearchTokens(values: Array<string | undefined | null>) {
  const tokens = new Set<string>();

  values
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .forEach((value) => {
      const normalized = normalizeSearchToken(value);
      if (!normalized) return;
      normalized.split(" ").forEach((token) => {
        if (token.length >= 2) {
          tokens.add(token);
        }
      });
    });

  return Array.from(tokens);
}

export function matchesSearchTokens(
  target: string,
  tokens: string[],
): boolean {
  if (tokens.length === 0) return true;
  const normalized = normalizeSearchToken(target) ?? "";
  return tokens.every((token) => normalized.includes(token));
}
