import { ToasterContainer, PLACEMENT } from "baseui/toast";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

import type { ReactElement } from "react";
import type { Children } from "./types";

const ToastProvider = ({ children }: Children): ReactElement => {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <ToasterContainer autoHideDuration={4000} closeable placement={PLACEMENT.bottomRight}>
          {children}
        </ToasterContainer>
      </MotionConfig>
    </LazyMotion>
  );
};

export { ToastProvider };
