import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

import type { ReactElement } from "react";
import type { Children } from "./shared/ui/types";

const MotionProvider = ({ children }: Children): ReactElement => {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
};

export { MotionProvider };
