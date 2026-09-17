import { Outlet, Scripts } from "@tanstack/react-router";
import { Navigation } from "#components/navigation.tsx";
import type { ReactElement } from "react";
import { UIProvider } from "@template/ui";

function DocumentBody(): ReactElement {
  return (
    <body>
      <UIProvider>
        <Navigation />
        <Outlet />
      </UIProvider>
      <Scripts />
    </body>
  );
}

export { DocumentBody };
