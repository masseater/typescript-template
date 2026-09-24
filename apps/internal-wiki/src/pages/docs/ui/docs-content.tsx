import {
  DocsBody,
  DocsDescription,
  DocsPage as DocsPageLayout,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";

import { glossaryTerms } from "#shared/content/index.ts";
import { GlossaryTermsProvider } from "./glossary-terms-provider.tsx";
import { Mermaid } from "./mermaid.tsx";
import { TermLink } from "./term-link.tsx";
import { WikiDocLink } from "./wiki-doc-link.tsx";

import type { docs } from "#shared/content/index.ts";
import type { ReactElement } from "react";

const mdxComponents = { ...defaultMdxComponents, Mermaid, TermLink, a: WikiDocLink };

type DocsEntry = NonNullable<ReturnType<typeof docs.getPage>>;

function DocsContent({ page, path }: Readonly<{ page: DocsEntry; path: string }>): ReactElement {
  const Body = page.body;
  return (
    <DocsPageLayout toc={page.toc}>
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <a
        className="w-fit rounded-sm text-sm text-link underline outline-none hover:text-link-hover focus-visible:focus-indicator-outer"
        href={`/wiki-edit/${path}`}
      >
        このページを編集
      </a>
      <DocsBody>
        <GlossaryTermsProvider terms={glossaryTerms()}>
          <Body components={mdxComponents} />
        </GlossaryTermsProvider>
      </DocsBody>
    </DocsPageLayout>
  );
}

export { DocsContent };
