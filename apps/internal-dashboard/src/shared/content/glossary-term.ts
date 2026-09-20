type GlossaryTerm = Readonly<{
  description: string;
  href: string;
  name: string;
  slug: string;
}>;

function findGlossaryTerm(terms: readonly GlossaryTerm[], term: string): GlossaryTerm | undefined {
  const needle = term.trim();
  if (needle.length === 0) {
    return undefined;
  }
  return terms.find(
    (entry) =>
      entry.name === needle ||
      entry.slug === needle ||
      entry.slug === needle.toLowerCase() ||
      entry.name.toLowerCase() === needle.toLowerCase(),
  );
}

export { findGlossaryTerm };
export type { GlossaryTerm };
