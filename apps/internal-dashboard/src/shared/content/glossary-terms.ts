import { WIKI_DOCS_BASE_URL } from "./resolve-wiki-doc-href.ts";
import { source } from "./source.ts";

import type { GlossaryTerm } from "./glossary-term.ts";

function glossaryTerms(): readonly GlossaryTerm[] {
  return source
    .getPages()
    .filter((page) => page.slugs[0] === "glossary" && page.slugs.length === 2)
    .map((page) => {
      const slug = page.slugs[1] ?? "";
      return {
        description: page.data.description ?? "",
        href: `${WIKI_DOCS_BASE_URL}/glossary/${slug}`,
        name: page.data.title,
        slug,
      };
    })
    .toSorted((left, right) => left.name.localeCompare(right.name, "ja"));
}

export { glossaryTerms };
export type { GlossaryTerm } from "./glossary-term.ts";
