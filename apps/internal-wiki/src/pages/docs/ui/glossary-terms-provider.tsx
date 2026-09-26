"use client";

import { GlossaryTermsContext } from "#pages/docs/model/glossary-terms.ts";

import type { GlossaryTerm } from "#shared/glossary-term/index.ts";
import type { ReactElement, ReactNode } from "react";

function GlossaryTermsProvider({
  children,
  terms,
}: Readonly<{ children: ReactNode; terms: readonly GlossaryTerm[] }>): ReactElement {
  return <GlossaryTermsContext value={terms}>{children}</GlossaryTermsContext>;
}

export { GlossaryTermsProvider };
