import { cva } from "class-variance-authority";

const buttonVariants = cva(
  "box-border inline-flex w-fit shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border text-center font-bold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:focus-indicator disabled:cursor-not-allowed",
  {
    defaultVariants: { size: "medium", variant: "secondary" },
    variants: {
      size: {
        large: "px-4 py-3 text-lg leading-none",
        medium: "px-2 py-1.5 text-base leading-none",
        small: "min-h-6 min-w-6 p-1 text-sm leading-none",
      },
      variant: {
        danger:
          "border-destructive bg-destructive text-destructive-foreground hover:border-destructive-hover hover:bg-destructive-hover hover:text-destructive-foreground disabled:border-destructive/50 disabled:bg-destructive/50 disabled:text-destructive-foreground/50",
        primary:
          "border-primary bg-primary text-primary-foreground hover:border-primary-hover hover:bg-primary-hover hover:text-primary-foreground disabled:border-primary/50 disabled:bg-primary/50 disabled:text-primary-foreground/50",
        secondary:
          "border-border bg-card text-foreground hover:bg-card-hover hover:text-foreground disabled:border-border/50 disabled:bg-card-hover disabled:text-disabled-foreground",
      },
    },
  },
);

export { buttonVariants };
