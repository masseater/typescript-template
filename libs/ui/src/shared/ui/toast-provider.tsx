import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import type { ReactElement } from "react";

import { ToastViewport } from "./toast-viewport";
import type { Children } from "./types";

function ToastProvider({ children }: Children): ReactElement {
  return (
    <ToastPrimitive.Provider>
      {children}
      <ToastViewport />
    </ToastPrimitive.Provider>
  );
}

export { ToastProvider };
