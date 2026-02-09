function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeSearchToken(
  value: string,
  options?: { stripDiacritics?: boolean },
) {
  const normalized = value
    .toLowerCase()
    .replace(/[#@.,;:!?"'`~()\[\]{}<>/\\|+=*^$%&_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length < 2) return null;
  return options?.stripDiacritics ? stripDiacritics(normalized) : normalized;
}

export function getSearchTokenVariants(value: string) {
  const withAccents = normalizeSearchToken(value, { stripDiacritics: false });
  const stripped = normalizeSearchToken(value, { stripDiacritics: true });
  const variants = [withAccents, stripped].filter(
    (token): token is string => !!token,
  );
  return Array.from(new Set(variants));
}

export function buildSearchTokens(values: Array<string | undefined | null>) {
  const tokens = new Set<string>();

  values
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .forEach((value) => {
      const variants = getSearchTokenVariants(value);
      variants.forEach((variant) => {
        variant.split(" ").forEach((token) => {
          if (token.length >= 2) {
            tokens.add(token);
          }
        });
      });
    });

  return Array.from(tokens);
}

export function matchesSearchTokens(
  target: string,
  tokens: string[],
): boolean {
  if (tokens.length === 0) return true;
  const normalized =
    normalizeSearchToken(target, { stripDiacritics: true }) ?? "";
  return tokens.every((token) => normalized.includes(token));
}
