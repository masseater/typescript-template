"use client";

import { createContext, use } from "react";

import type { GlossaryTerm } from "#shared/content/glossary-term.ts";
import type { ReactElement, ReactNode } from "react";

const GlossaryTermsContext = createContext<readonly GlossaryTerm[]>([]);

function GlossaryTermsProvider({
  children,
  terms,
}: Readonly<{ children: ReactNode; terms: readonly GlossaryTerm[] }>): ReactElement {
  return <GlossaryTermsContext value={terms}>{children}</GlossaryTermsContext>;
}

function useGlossaryTerms(): readonly GlossaryTerm[] {
  return use(GlossaryTermsContext);
}

export { GlossaryTermsProvider, useGlossaryTerms };
