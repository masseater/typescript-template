import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

import { ToastViewport } from "./toast-viewport";

import type { ReactElement } from "react";
import type { Children } from "./types";

function ToastProvider({ children }: Children): ReactElement {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <ToastPrimitive.Provider>
          {children}
          <ToastViewport />
        </ToastPrimitive.Provider>
      </MotionConfig>
    </LazyMotion>
  );
}

export { ToastProvider };
