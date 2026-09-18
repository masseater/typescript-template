import type { Children } from "./shared/ui/types";
import type { ReactElement } from "react";
import { RegistryProvider } from "@effect/atom-react";
import { Scripts } from "@tanstack/react-router";

function AppBody({ children }: Children): ReactElement {
  return (
    <body>
      <RegistryProvider>{children}</RegistryProvider>
      <Scripts />
    </body>
  );
}

export { AppBody };
