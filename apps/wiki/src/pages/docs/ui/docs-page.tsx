import { ButtonLink, Icon } from "@repo/ui";
import { getRouteApi, notFound } from "@tanstack/react-router";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { SearchIcon } from "lucide-react";

import { docs } from "#shared/content/index.ts";
import { DocsContent } from "./docs-content.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/$");
const nav = { title: "Wiki", url: "/getting-started/what-is-this" };

function DocsPage(): ReactElement {
  const { path, pageTree } = useFumadocsLoader(route.useLoaderData());
  const page = docs.getPage(path);
  if (!page) {
    throw notFound();
  }
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-2">
        <ButtonLink to="/getting-started/what-is-this" variant="secondary">
          Wiki
        </ButtonLink>
        <label className="ml-auto flex max-w-64 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-card px-2 py-1 text-muted-foreground md:ml-0">
          <Icon icon={SearchIcon} size="small" />
          <input
            type="search"
            placeholder="文書を検索"
            disabled
            className="min-w-0 flex-1 bg-transparent text-base leading-tight text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
        </label>
        <ButtonLink to="/" variant="secondary">
          ダッシュボード
        </ButtonLink>
      </header>
      <DocsLayout nav={nav} tree={pageTree}>
        <DocsContent page={page} />
      </DocsLayout>
    </div>
  );
}

export { DocsPage };
