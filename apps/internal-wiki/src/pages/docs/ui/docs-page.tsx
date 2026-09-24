import { wikiBasePath } from "@repo/config";
import { notFound } from "@tanstack/react-router";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { docs } from "#shared/content/index.ts";
import { DocsContent } from "./docs-content.tsx";

import type { Root } from "fumadocs-core/page-tree";
import type { ReactElement } from "react";

const nav = { title: "Wiki", url: wikiBasePath };

type DocsLoaderData = Readonly<{
  pageTree: Root;
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
      <DocsContent page={page} path={path} />
    </DocsLayout>
  );
}

export { DocsPage };
