import Link from "fumadocs-core/link";

import { resolveWikiDocHref } from "#shared/content/index.ts";

import type { ComponentProps, ReactElement } from "react";

function WikiDocLink({ href, ...props }: ComponentProps<typeof Link>): ReactElement {
  return <Link href={href === undefined ? href : resolveWikiDocHref(href)} {...props} />;
}

export { WikiDocLink };
