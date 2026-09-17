import { Toast as ToastPrimitive } from "@base-ui/react/toast";

type ToastVariant = "error" | "success";

function useToast(): (variant: ToastVariant, title: string) => void {
  const { add } = ToastPrimitive.useToastManager();
  function notify(variant: ToastVariant, title: string): void {
    add({ priority: variant === "error" ? "high" : "low", title, type: variant });
  }
  return notify;
}

export { useToast };
