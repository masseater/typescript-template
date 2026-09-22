import { cva } from "class-variance-authority";

import type { ReactElement } from "react";
import type { Children } from "./types";

const headingVariants = cva("text-foreground", {
  defaultVariants: { size: "section" },
  variants: {
    size: {
      block: "font-sans text-base leading-tight font-bold",
      page: "font-display text-3xl leading-tight font-medium",
      section: "font-sans text-lg leading-tight font-bold",
    },
  },
});

const Heading = ({
  as: Tag = "h2",
  children,
  size,
}: Children &
  Readonly<{ as?: "h1" | "h2" | "h3"; size?: "block" | "page" | "section" }>): ReactElement => {
  return (
    <Tag data-slot="heading" className={headingVariants({ size })}>
      {children}
    </Tag>
  );
};

export { Heading };
