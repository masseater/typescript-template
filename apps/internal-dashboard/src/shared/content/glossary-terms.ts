import { WIKI_DOCS_BASE_URL } from "./resolve-wiki-doc-href.ts";
import { source } from "./source.ts";

import type { GlossaryTerm } from "./glossary-term.ts";

function glossaryTerms(): readonly GlossaryTerm[] {
  const terms: GlossaryTerm[] = [];
  for (const page of source.getPages()) {
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

export { glossaryTerms };
