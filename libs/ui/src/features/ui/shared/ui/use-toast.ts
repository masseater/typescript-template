import { toaster } from "baseui/toast";

import { STATUS_VARIANT } from "./status-variants.ts";

const useToast = (): ((
  variant: "error" | (typeof STATUS_VARIANT)["failure" | "success"],
  title: string,
) => void) => {
  return (variant, title) => {
    if (variant === "error" || variant === STATUS_VARIANT.failure) {
      toaster.negative(title);
      return;
    }
    toaster.positive(title);
  };
};

export { useToast };
