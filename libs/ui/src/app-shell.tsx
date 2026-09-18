import { AppBody } from "./app-body";
import type { Children } from "./shared/ui/types";
import { HeadContent } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { initBrowserTelemetry } from "@repo/observability/browser";
import { useEffect } from "react";

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
