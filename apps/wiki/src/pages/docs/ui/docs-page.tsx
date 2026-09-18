import { getRouteApi, notFound } from "@tanstack/react-router";
import { DocsContent } from "./docs-content.tsx";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactElement } from "react";
import { docs } from "#shared/content/index.ts";
import { serviceName } from "#shared/config/index.ts";
import { useFumadocsLoader } from "fumadocs-core/source/client";

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
