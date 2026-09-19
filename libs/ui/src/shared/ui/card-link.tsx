import { createLink } from "@tanstack/react-router";

import type { ComponentProps, ReactElement } from "react";

const CardAnchor = ({ children, ...anchor }: Readonly<ComponentProps<"a">>): ReactElement => {
  return (
    <a
      {...anchor}
      data-slot="card-link"
      className="flex h-full w-full items-start gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground no-underline shadow-sm outline-none hover:bg-card-hover hover:text-card-foreground focus-visible:focus-indicator"
    >
      {children}
    </a>
  );
};

const CardLink = createLink(CardAnchor);

export { CardLink };
