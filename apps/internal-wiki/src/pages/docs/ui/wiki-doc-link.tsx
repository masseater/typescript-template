import Link from "fumadocs-core/link";

import { resolveWikiDocHref } from "#shared/content/index.ts";

import type { ComponentProps, ReactElement } from "react";

function WikiDocLink({
  children,
  href,
  title,
}: Pick<ComponentProps<typeof Link>, "children" | "href" | "title">): ReactElement {
  return (
    <Link href={href === undefined ? href : resolveWikiDocHref(href)} title={title}>
      {children}
    </Link>
  );
}

export { WikiDocLink };
