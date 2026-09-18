import { Scripts } from "@tanstack/react-router";

import type { ReactElement } from "react";
import type { Children } from "./shared/ui/types";

const AppBody = ({ children }: Children): ReactElement => {
  return (
    <body>
      {children}
      <Scripts />
    </body>
  );
};

export { AppBody };
