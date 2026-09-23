import { WIKI_DOCS_BASE_URL } from "./resolve-wiki-doc-href.ts";

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

type GlossaryPage = Readonly<{
  data: Readonly<{ description?: string | undefined; title: string }>;
  slugs: readonly string[];
}>;

function glossaryTermsOf(pages: readonly GlossaryPage[]): readonly GlossaryTerm[] {
  const terms: GlossaryTerm[] = [];
  for (const page of pages) {
    if (page.slugs[0] !== "glossary" || page.slugs.length !== 2) {
      continue;
    }
    const slug = page.slugs[1] ?? "";
    terms.push({
      description: page.data.description ?? "",
      href: `${WIKI_DOCS_BASE_URL}/glossary/${slug}`,
      name: page.data.title,
      slug,
    });
  }
  return terms.toSorted((left, right) => left.name.localeCompare(right.name, "ja"));
}

export { findGlossaryTerm, glossaryTermsOf };
export type { GlossaryTerm };
