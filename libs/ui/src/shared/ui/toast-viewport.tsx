import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import type { ReactElement } from "react";

import { ToastItem } from "./toast-item";

function ToastViewport(): ReactElement {
  const { toasts } = ToastPrimitive.useToastManager();
  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport className="fixed right-4 bottom-4 z-50 flex w-full max-w-toast flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  );
}

export { ToastViewport };
