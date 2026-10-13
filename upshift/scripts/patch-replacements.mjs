const TWENTY_BRAND_WORD = /(?<![\w@./-])Twenty(?!\w|\.[a-z])/g;

export const countOccurrences = (content, needle) =>
  content.split(needle).length - 1;

export const applyReplacements = (
  content,
  replacements,
  fillTemplate = (value) => value,
  brandName = 'Upshift',
) => {
  let replacementCount = 0;
  const failures = [];
  const fail = (message) => failures.push(message);
  for (const replacement of replacements) {
    if (replacement.brandWord) {
      const matches = content.match(TWENTY_BRAND_WORD) ?? [];
      const minimum = replacement.minimum ?? 1;

      if (matches.length < minimum) {
        fail(
          `expected at least ${minimum} "Twenty" mentions, found ${matches.length}`,
        );
        continue;
      }

      content = content.replace(TWENTY_BRAND_WORD, brandName);
      replacementCount += matches.length;
      continue;
    }

    if (replacement.pattern) {
      const matches = content.match(replacement.pattern) ?? [];

      if (matches.length === 0) {
        fail(`pattern ${replacement.pattern} not found`);
        continue;
      }

      content = content.replace(
        replacement.pattern,
        fillTemplate(replacement.to),
      );
      replacementCount += matches.length;
      continue;
    }

    const expectedCount = replacement.count ?? 1;
    const actualCount = countOccurrences(content, replacement.from);

    // Safe to skip: the reference census still fails on a Twenty link the patch no longer finds
    if (actualCount === 0 && replacement.optional) {
      continue;
    }

    if (actualCount !== expectedCount) {
      fail(
        `expected ${expectedCount} occurrence(s) of ${JSON.stringify(replacement.from.split('\n')[0])}, found ${actualCount}`,
      );
      continue;
    }

    content = content.split(replacement.from).join(fillTemplate(replacement.to));
    replacementCount += actualCount;
  }
  return { content, replacementCount, failures };
};
