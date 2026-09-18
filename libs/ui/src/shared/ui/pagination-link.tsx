import { createLink } from "@tanstack/react-router";
import { cva } from "class-variance-authority";
import type { ComponentProps, ReactElement } from "react";

const paginationLinkVariants = cva(
  "inline-flex min-w-8 items-center justify-center rounded-md border px-2 py-1 text-base leading-tight no-underline outline-none focus-visible:focus-indicator",
  {
    defaultVariants: { current: false },
    variants: {
      current: {
        false: "border-border bg-card text-foreground hover:bg-card-hover hover:text-foreground",
        true: "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
      },
    },
  },
);

type PaginationAnchorProps = Readonly<ComponentProps<"a"> & { current?: boolean }>;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function PaginationAnchor({ children, current, ...anchor }: PaginationAnchorProps): ReactElement {
  return (
    <a
      // oxlint-disable-next-line react/jsx-props-no-spreading
      {...anchor}
      data-slot="pagination-link"
      aria-current={current === true ? "page" : undefined}
      className={paginationLinkVariants({ current })}
    >
      {children}
    </a>
  );
}

const PaginationLink = createLink(PaginationAnchor);

export { PaginationLink };
