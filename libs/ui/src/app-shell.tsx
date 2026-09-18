import { initBrowserTelemetry } from "@repo/observability/browser";
import { HeadContent } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppBody } from "./app-body";

import type { ReactElement } from "react";
import type { Children } from "./shared/ui/types";

function AppShell({
  children,
  routes,
}: Children & Readonly<{ routes: Readonly<Record<string, string>> }>): ReactElement {
  useEffect(() => {
    const telemetry = initBrowserTelemetry({ endpoint: "/api/telemetry", routes });
    return (): void => {
      telemetry.dispose();
    };
  }, [routes]);
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <AppBody>{children}</AppBody>
    </html>
  );
}

export { AppShell };
