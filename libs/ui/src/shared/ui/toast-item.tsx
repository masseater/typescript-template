import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { CircleAlertIcon, CircleCheckIcon, XIcon } from "lucide-react";
import * as m from "motion/react-m";

import type { ReactElement } from "react";

type ToastObject = ReturnType<typeof ToastPrimitive.useToastManager>["toasts"][number];

function ToastItem({ toast }: Readonly<{ toast: ToastObject }>): ReactElement {
  return (
    <m.div
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      initial={{ opacity: 0, transform: "translateY(8px)" }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <ToastPrimitive.Root
        toast={toast}
        data-slot="toast"
        className="flex w-full items-start gap-2 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-lg"
      >
        {toast.type === "error" ? (
          <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
        ) : (
          <CircleCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
        )}
        <ToastPrimitive.Title className="grow text-base leading-normal" />
        <ToastPrimitive.Close
          aria-label="通知を閉じる"
          className="cursor-pointer rounded-sm text-muted-foreground outline-none focus-visible:focus-indicator-outer"
        >
          <XIcon aria-hidden="true" className="size-4" />
        </ToastPrimitive.Close>
      </ToastPrimitive.Root>
    </m.div>
  );
}

export { ToastItem };
