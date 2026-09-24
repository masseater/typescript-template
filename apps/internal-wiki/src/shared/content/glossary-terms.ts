import { wikiBasePath } from "@repo/config";

import { source } from "./source.ts";

import type { GlossaryTerm } from "#shared/glossary-term/index.ts";

function glossaryTerms(): readonly GlossaryTerm[] {
  return source
    .getPages()
    .filter((page) => page.slugs.length === 2 && page.slugs[0] === "glossary")
    .map(({ data, slugs: [, slug = ""] }) => ({
      description: data.description ?? "",
      href: `${wikiBasePath}/glossary/${slug}`,
      name: data.title,
      slug,
    }))
    .toSorted((left, right) => left.name.localeCompare(right.name, "ja"));
}

export { glossaryTerms };
