import { cn } from "cn";
import { CircleAlertIcon, CircleCheckIcon, InfoIcon } from "lucide-react";

import { Spinner } from "./spinner";
import { STATUS_VARIANT, type StatusVariant } from "./status-variants.ts";

import type { ReactElement, ReactNode, ReactPortal } from "react";

const iconClassName = "mt-0.5 size-4 shrink-0";

const icons: Readonly<Record<StatusVariant, ReactElement | null>> = {
  empty: null,
  failure: <CircleAlertIcon aria-hidden="true" className={cn(iconClassName, "text-destructive")} />,
  info: <InfoIcon aria-hidden="true" className={cn(iconClassName, "text-muted-foreground")} />,
  pending: <Spinner />,
  success: <CircleCheckIcon aria-hidden="true" className={cn(iconClassName, "text-success")} />,
};

const tones: Readonly<Record<StatusVariant, string>> = {
  empty: "text-muted-foreground",
  failure: "text-destructive",
  info: "text-foreground",
  pending: "text-muted-foreground",
  success: "text-foreground",
};

const StatusMessage = ({
  variant = STATUS_VARIANT.info,
  children,
}: Readonly<{
  variant?: StatusVariant;
  children: Readonly<Exclude<ReactNode, ReactPortal>>;
}>): ReactElement => {
  return (
    <p
      data-slot="status"
      role={variant === STATUS_VARIANT.failure ? "alert" : "status"}
      aria-live={variant === STATUS_VARIANT.failure ? "assertive" : "polite"}
      className={cn("inline-flex items-start gap-1 text-base leading-normal", tones[variant])}
    >
      {icons[variant]}
      <span>{children}</span>
    </p>
  );
};

export { StatusMessage };
