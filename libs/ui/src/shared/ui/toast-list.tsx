import { CircleCheckIcon, XIcon } from "lucide-react";
import type { ReactElement } from "react";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";

function ToastList(): ReactElement[] {
  const { toasts } = ToastPrimitive.useToastManager();
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return toasts.map((toast) => (
    <ToastPrimitive.Root
      key={toast.id}
      toast={toast}
      data-slot="toast"
      className="flex w-full items-start gap-2 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-lg"
    >
      <CircleCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
      <ToastPrimitive.Content className="flex-1">
        <ToastPrimitive.Title className="text-base leading-normal" />
      </ToastPrimitive.Content>
      <ToastPrimitive.Close
        aria-label="通知を閉じる"
        className="cursor-pointer outline-none focus-visible:focus-indicator"
      >
        <XIcon aria-hidden="true" className="size-4" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  ));
}

export { ToastList };
