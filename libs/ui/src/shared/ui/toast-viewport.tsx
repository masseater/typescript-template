import type { ReactElement } from "react";
import { ToastList } from "./toast-list";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";

function ToastViewport(): ReactElement {
  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport
        data-slot="toaster"
        className="fixed top-4 right-4 left-4 z-50 mx-auto flex w-auto max-w-md flex-col gap-2"
      >
        <ToastList />
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  );
}

export { ToastViewport };
