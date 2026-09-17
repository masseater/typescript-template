import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { docs, source } from "../lib/source.ts";

const loadPage = createServerFn({ method: "GET" })
  .validator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs);
    if (!page) throw notFound();
    return { path: page.path, pageTree: await source.serializePageTree(source.getPageTree()) };
  });

export const Route = createFileRoute("/$")({
  loader: ({ location }) =>
    loadPage({ data: location.pathname.split("/").filter(Boolean).map(decodeURIComponent) }),
  component: Page,
});

function Page() {
  const { path, pageTree } = useFumadocsLoader(Route.useLoaderData());
  const page = docs.getPage(path);
  if (!page) throw notFound();
  const Body = page.body;
  return (
    <DocsLayout nav={{ title: "Wiki" }} tree={pageTree}>
      <DocsPage toc={page.toc}>
        <DocsTitle>{page.title}</DocsTitle>
        <DocsDescription>{page.description}</DocsDescription>
        <DocsBody>
          <Body components={defaultMdxComponents} />
        </DocsBody>
      </DocsPage>
    </DocsLayout>
  );
}
