import { Outlet, getRouteApi } from "@tanstack/react-router";
import { AppDevtools } from "#app/devtools.tsx";
import { AppShell } from "@template/ui/shell";
import { DbProvider } from "@tanstack/react-db";
import type { ReactElement } from "react";
import { routes } from "#shared/telemetry/index.ts";

const route = getRouteApi("__root__");

function RootLayout(): ReactElement {
  const { dbClient } = route.useRouteContext();
  return (
    <AppShell routes={routes}>
      <DbProvider client={dbClient}>
        <Outlet />
      </DbProvider>
      <AppDevtools />
    </AppShell>
  );
}

export { RootLayout };
