import { getRouteApi, notFound } from "@tanstack/react-router";
import { DocsContent } from "./docs-content.tsx";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactElement } from "react";
import { docs } from "#/lib/source.ts";
import { useFumadocsLoader } from "fumadocs-core/source/client";

const route = getRouteApi("/$");
const nav = { title: "Wiki" };

function DocsRoutePage(): ReactElement {
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

export { DocsRoutePage };
