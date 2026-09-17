import type { Children } from "./types";
import type { ReactElement } from "react";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { ToastViewport } from "./toast-viewport";

function Toaster({ children }: Children): ReactElement {
  return (
    <ToastPrimitive.Provider>
      {children}
      <ToastViewport />
    </ToastPrimitive.Provider>
  );
}

export { Toaster };
