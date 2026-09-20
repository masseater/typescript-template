import {
  DocsBody,
  DocsDescription,
  DocsPage as DocsPageLayout,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";

import { glossaryTerms } from "#shared/content/glossary-terms.ts";
import { GlossaryTermsProvider } from "./glossary-terms-provider.tsx";
import { Mermaid } from "./mermaid.tsx";
import { TermLink } from "./term-link.tsx";
import { WikiDocLink } from "./wiki-doc-link.tsx";

import type { docs } from "#shared/content/index.ts";
import type { ReactElement } from "react";

const mdxComponents = { ...defaultMdxComponents, Mermaid, TermLink, a: WikiDocLink };

type DocsEntry = NonNullable<ReturnType<typeof docs.getPage>>;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function DocsContent({ page }: Readonly<{ page: DocsEntry }>): ReactElement {
  const Body = page.body;
  return (
    <DocsPageLayout toc={page.toc}>
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <DocsBody>
        <GlossaryTermsProvider terms={glossaryTerms()}>
          <Body components={mdxComponents} />
        </GlossaryTermsProvider>
      </DocsBody>
    </DocsPageLayout>
  );
}

export { DocsContent };
