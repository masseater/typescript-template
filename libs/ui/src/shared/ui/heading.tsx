import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const headingVariants = cva("leading-tight font-bold text-foreground", {
  variants: {
    size: {
      screen: "text-xl",
      section: "text-lg",
      block: "text-base",
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
