import { notFound } from "@tanstack/react-router";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { docs } from "#shared/content/index.ts";
import { DocsContent } from "./docs-content.tsx";

import type { ReactElement } from "react";

const nav = { title: "Wiki", url: "/wiki" };

type DocsLoaderData = Readonly<{
  pageTree: unknown;
  path: string;
}>;

function DocsPage({ data }: Readonly<{ data: DocsLoaderData }>): ReactElement {
  const { path, pageTree } = useFumadocsLoader(data);
  const page = docs.getPage(path);
  if (!page) {
    throw notFound();
  }
  return (
    <DocsLayout nav={nav} tree={pageTree}>
      <DocsContent page={page} />
    </DocsLayout>
  );
}

export { DocsPage };
