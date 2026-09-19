import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { source } from "#shared/content/index.ts";

const loadWikiPage = createServerFn({ method: "GET" })
  .validator((slugs: readonly string[]) => [...slugs])
  .handler(async ({ data: slugs }: Readonly<{ data: readonly string[] }>) => {
    const page = source.getPage([...slugs]);
    if (!page) {
      throw notFound();
    }
    return { pageTree: await source.serializePageTree(source.getPageTree()), path: page.path };
  });

export { loadWikiPage };
