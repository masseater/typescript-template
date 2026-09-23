import { ToasterContainer, PLACEMENT } from "baseui/toast";

import type { ReactElement } from "react";
import type { Children } from "./types";

const ToastProvider = ({ children }: Children): ReactElement => {
  return (
    <ToasterContainer autoHideDuration={4000} closeable placement={PLACEMENT.bottomRight}>
      {children}
    </ToasterContainer>
  );
};

export { ToastProvider };
