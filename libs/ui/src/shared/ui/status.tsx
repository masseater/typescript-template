import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { CircleAlertIcon, CircleCheckIcon, InfoIcon } from "lucide-react";
import { Spinner } from "./spinner";

const statusVariants = cva("inline-flex items-start gap-1 text-base leading-normal", {
  variants: {
    variant: {
      info: "text-foreground",
      success: "text-foreground",
      error: "text-destructive",
      pending: "text-muted-foreground",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

const icons = {
  info: <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />,
  success: <CircleCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />,
  error: <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />,
  pending: <Spinner className="mt-0.5" />,
} as const;

function Status({
  variant = "info",
  className,
  children,
}: VariantProps<typeof statusVariants> & { className?: string; children: ReactNode }) {
  const level = variant ?? "info";
  return (
    <p
      data-slot="status"
      role={level === "error" ? "alert" : "status"}
      aria-live={level === "error" ? "assertive" : "polite"}
      className={cn(statusVariants({ variant: level }), className)}
    >
      {icons[level]}
      <span>{children}</span>
    </p>
  );
}

export { Status };
