import { HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { WikiProvider } from "./wiki-provider.tsx";
import { connectBrowserSentry } from "@template/observability/sentry-browser";
import { initBrowserTelemetry } from "@template/observability/browser";
import { routes } from "#/telemetry-routes.ts";
import { useEffect } from "react";

function useBrowserTelemetry(): void {
  useEffect(() => {
    const telemetry = initBrowserTelemetry({ endpoint: "/api/telemetry", routes });
    const disconnectSentry = connectBrowserSentry();
    return (): void => {
      disconnectSentry();
      telemetry.dispose();
    };
  }, []);
}

function RootDocument(): ReactElement {
  useBrowserTelemetry();
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col">
        <WikiProvider />
        <Scripts />
      </body>
    </html>
  );
}

export { RootDocument };
