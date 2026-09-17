import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const headingVariants = cva("font-bold text-foreground", {
  variants: {
    size: {
      screen: "text-xl leading-tight",
      section: "text-lg leading-tight",
      block: "text-base leading-tight",
    },
  },
  defaultVariants: {
    size: "section",
  },
});

function Heading({
  as: Tag = "h2",
  size,
  className,
  ...props
}: ComponentProps<"h2"> & VariantProps<typeof headingVariants> & { as?: "h1" | "h2" | "h3" }) {
  return (
    <Tag data-slot="heading" className={cn(headingVariants({ size, className }))} {...props} />
  );
}

export { Heading };
