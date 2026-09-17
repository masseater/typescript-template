import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsRoutePage } from "#/components/docs-route-page.tsx";
import { createServerFn } from "@tanstack/react-start";
import { source } from "#/lib/source.ts";

const loadPage = createServerFn({ method: "GET" })
  .validator((slugs: readonly string[]) => [...slugs])
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs);
    if (!page) {
      throw notFound();
    }
    return { pageTree: await source.serializePageTree(source.getPageTree()), path: page.path };
  });

const Route = createFileRoute("/$")({
  component: DocsRoutePage,
  loader: async ({ location }) =>
    loadPage({
      data: location.pathname
        .split("/")
        .filter(Boolean)
        .map((segment) => decodeURIComponent(segment)),
    }),
});

export { Route };
