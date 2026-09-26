import { createContext, use } from "react";

import type { GlossaryTerm } from "#shared/glossary-term/index.ts";

const GlossaryTermsContext = createContext<readonly GlossaryTerm[]>([]);

function useGlossaryTerms(): readonly GlossaryTerm[] {
  return use(GlossaryTermsContext);
}

export { GlossaryTermsContext, useGlossaryTerms };
