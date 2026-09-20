import Link from "fumadocs-core/link";
import { createElement } from "react";

import { resolveWikiDocHref } from "#shared/content/index.ts";

import type { ComponentProps, ReactElement } from "react";

function WikiDocLink({ href, ...props }: ComponentProps<typeof Link>): ReactElement {
  return createElement(Link, {
    ...props,
    href: href === undefined ? href : resolveWikiDocHref(href),
  });
}

export { WikiDocLink };
