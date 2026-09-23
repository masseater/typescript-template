import { glossaryTermsOf } from "#shared/wiki-link/index.ts";
import { source } from "./source.ts";

import type { GlossaryTerm } from "#shared/wiki-link/index.ts";

function glossaryTerms(): readonly GlossaryTerm[] {
  return glossaryTermsOf(source.getPages());
}

export { glossaryTerms };
