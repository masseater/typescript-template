import { Toast as ToastPrimitive } from "@base-ui/react/toast";

type ToastVariant = "error" | "success";

const useToast = (): ((variant: ToastVariant, title: string) => void) => {
  const { add } = ToastPrimitive.useToastManager();
  const notify = (variant: ToastVariant, title: string): void => {
    add({ priority: variant === "error" ? "high" : "low", title, type: variant });
  };
  return notify;
};

export { useToast };
