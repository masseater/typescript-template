import { createLink } from "@tanstack/react-router";

import type { ComponentProps, ReactElement } from "react";

function TextAnchor({ children, ...anchor }: Readonly<ComponentProps<"a">>): ReactElement {
  return (
    <a
      {...anchor}
      data-slot="text-link"
      className="rounded-sm text-link underline outline-none hover:text-link-hover focus-visible:focus-indicator-outer"
    >
      {children}
    </a>
  );
}

const TextLink = createLink(TextAnchor);

export { TextLink };
