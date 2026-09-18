import { getRouteApi, notFound } from "@tanstack/react-router";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactElement } from "react";

import { serviceName } from "#shared/config/index.ts";
import { docs } from "#shared/content/index.ts";

import { DocsContent } from "./docs-content.tsx";

const route = getRouteApi("/$");
const nav = { title: serviceName };

function DocsPage(): ReactElement {
  const { path, pageTree } = useFumadocsLoader(route.useLoaderData());
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
