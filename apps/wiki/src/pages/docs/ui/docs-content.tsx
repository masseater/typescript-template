import {
  DocsBody,
  DocsDescription,
  DocsPage as DocsPageLayout,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { ReactElement } from "react";

import type { docs } from "#shared/content/index.ts";

import { Mermaid } from "./mermaid.tsx";

const mdxComponents = { ...defaultMdxComponents, Mermaid };

type DocsEntry = NonNullable<ReturnType<typeof docs.getPage>>;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function DocsContent({ page }: Readonly<{ page: DocsEntry }>): ReactElement {
  const Body = page.body;
  return (
    <DocsPageLayout toc={page.toc}>
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <DocsBody>
        <Body components={mdxComponents} />
      </DocsBody>
    </DocsPageLayout>
  );
}

export { DocsContent };
