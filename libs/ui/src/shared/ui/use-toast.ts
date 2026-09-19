import { Toast as ToastPrimitive } from "@base-ui/react/toast";

import { STATUS_VARIANT } from "./status-variants.ts";

type ToastVariant = (typeof STATUS_VARIANT)[keyof Omit<typeof STATUS_VARIANT, "info" | "pending">];

const useToast = (): ((variant: ToastVariant, title: string) => void) => {
  const { add } = ToastPrimitive.useToastManager();
  const notify = (variant: ToastVariant, title: string): void => {
    add({ priority: variant === STATUS_VARIANT.failure ? "high" : "low", title, type: variant });
  };
  return notify;
};

export { useToast };
