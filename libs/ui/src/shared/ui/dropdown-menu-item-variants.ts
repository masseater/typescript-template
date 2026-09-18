import { cva } from "class-variance-authority";

const itemVariants = cva(
  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-base leading-tight outline-none select-none data-highlighted:bg-accent data-disabled:cursor-not-allowed data-disabled:text-disabled-foreground",
  {
    defaultVariants: { variant: "default" },
    variants: {
      variant: {
        default: "text-foreground",
        destructive: "text-destructive",
      },
    },
  },
);

export { itemVariants };
