import { cva } from "class-variance-authority";

import type { ReactElement } from "react";
import type { Children } from "./types";

const headingVariants = cva("font-bold text-foreground", {
  defaultVariants: { size: "section" },
  variants: {
    size: {
      block: "text-base leading-tight",
      page: "text-xl leading-tight",
      section: "text-lg leading-tight",
    },
  },
});

function Heading({
  as: Tag = "h2",
  children,
  size,
}: Children &
  Readonly<{ as?: "h1" | "h2" | "h3"; size?: "block" | "page" | "section" }>): ReactElement {
  return (
    <Tag data-slot="heading" className={headingVariants({ size })}>
      {children}
    </Tag>
  );
}

export { Heading };
