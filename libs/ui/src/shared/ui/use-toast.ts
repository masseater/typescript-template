import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { useCallback } from "react";

type ToastVariant = "error" | "success";

function useToast(): (variant: ToastVariant, title: string) => void {
  const { add } = ToastPrimitive.useToastManager();
  return useCallback(
    (variant: ToastVariant, title: string) => {
      add({ priority: variant === "error" ? "high" : "low", title, type: variant });
    },
    [add],
  );
}

export { useToast };
