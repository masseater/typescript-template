import type { Children } from "./shared/ui/types";
import type { ReactElement } from "react";
import { Scripts } from "@tanstack/react-router";

function AppBody({ children }: Children): ReactElement {
  return (
    <body>
      {children}
      <Scripts />
    </body>
  );
}

export { AppBody };
