import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import type { ReactElement } from "react";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { docs } from "#/lib/source.ts";

type DocsEntry = NonNullable<ReturnType<typeof docs.getPage>>;

function DocsContent({ page }: Readonly<{ page: DocsEntry }>): ReactElement {
  const Body = page.body;
  return (
    <DocsPage toc={page.toc}>
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <DocsBody>
        <Body components={defaultMdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}

export { DocsContent };
