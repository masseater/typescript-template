import { Toast as ToastPrimitive } from "@base-ui/react/toast";

import { STATUS_VARIANT } from "./status-variants.ts";

type ToastVariant =
  | "error"
  | (typeof STATUS_VARIANT)[keyof Omit<typeof STATUS_VARIANT, "empty" | "info" | "pending">];

const useToast = (): ((variant: ToastVariant, title: string) => void) => {
  const { add } = ToastPrimitive.useToastManager();
  const notify = (variant: ToastVariant, title: string): void => {
    add({
      priority: variant === STATUS_VARIANT.success ? "low" : "high",
      title,
      type: variant,
    });
  };
  return notify;
};

export { useToast };
