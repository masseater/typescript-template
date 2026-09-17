import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const buttonVariants = cva(
  "box-border inline-flex w-fit cursor-pointer shrink-0 items-center justify-center gap-1 rounded-md border text-center font-bold whitespace-nowrap transition-colors outline-none select-none focus-visible:focus-indicator disabled:cursor-not-allowed [&_svg]:block [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        secondary:
          "border-border bg-card text-foreground hover:bg-card-hover disabled:border-border/50 disabled:bg-card-hover disabled:text-disabled-foreground",
        primary:
          "border-primary bg-primary text-primary-foreground hover:border-primary-hover hover:bg-primary-hover disabled:border-primary/50 disabled:bg-primary/50 disabled:text-primary-foreground/50",
        danger:
          "border-destructive bg-destructive text-destructive-foreground hover:border-destructive-hover hover:bg-destructive-hover disabled:border-destructive/50 disabled:bg-destructive/50 disabled:text-destructive-foreground/50",
        text: "border-transparent bg-transparent text-foreground hover:bg-card-hover disabled:text-disabled-foreground",
      },
      size: {
        M: "px-2 py-1.5 text-base leading-none",
        S: "p-1 text-sm leading-none",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "M",
    },
  },
);

function Button({
  className,
  variant,
  size,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button };
