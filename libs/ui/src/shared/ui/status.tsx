import { cn } from "cn";
import { CircleAlertIcon, CircleCheckIcon, InfoIcon } from "lucide-react";
import type { ReactElement, ReactNode, ReactPortal } from "react";

import { Spinner } from "./spinner";

type StatusVariant = "error" | "info" | "pending" | "success";

const iconClassName = "mt-0.5 size-4 shrink-0";

const icons: Readonly<Record<StatusVariant, ReactElement>> = {
  error: <CircleAlertIcon aria-hidden="true" className={cn(iconClassName, "text-destructive")} />,
  info: <InfoIcon aria-hidden="true" className={cn(iconClassName, "text-muted-foreground")} />,
  pending: <Spinner />,
  success: <CircleCheckIcon aria-hidden="true" className={cn(iconClassName, "text-success")} />,
};

const tones: Readonly<Record<StatusVariant, string>> = {
  error: "text-destructive",
  info: "text-foreground",
  pending: "text-muted-foreground",
  success: "text-foreground",
};

function Status({
  variant = "info",
  children,
}: Readonly<{
  variant?: StatusVariant;
  children: Readonly<Exclude<ReactNode, ReactPortal>>;
}>): ReactElement {
  return (
    <p
      data-slot="status"
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={cn("inline-flex items-start gap-1 text-base leading-normal", tones[variant])}
    >
      {icons[variant]}
      <span>{children}</span>
    </p>
  );
}

export { Status };
