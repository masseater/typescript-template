import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { DocsPage } from "#pages/docs/index.ts";
import { source } from "#shared/content/index.ts";

const loadPage = createServerFn({ method: "GET" })
  .validator((slugs: readonly string[]) => [...slugs])
  .handler(async ({ data: slugs }: Readonly<{ data: readonly string[] }>) => {
    const page = source.getPage([...slugs]);
    if (!page) {
      throw notFound();
    }
    return { pageTree: await source.serializePageTree(source.getPageTree()), path: page.path };
  });

const Route = createFileRoute("/$")({
  component: DocsPage,
  loader: async ({ location }: Readonly<{ location: Readonly<{ pathname: string }> }>) =>
    loadPage({
      data: location.pathname
        .split("/")
        .filter(Boolean)
        .map((segment) => decodeURIComponent(segment)),
    }),
});

export { Route };
