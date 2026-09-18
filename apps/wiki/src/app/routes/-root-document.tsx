import { HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { WikiProvider } from "./-wiki-provider.tsx";
import { initBrowserTelemetry } from "@repo/observability/browser";
import { routes } from "#shared/telemetry/index.ts";
import { useEffect } from "react";

function useBrowserTelemetry(): void {
  useEffect(() => {
    const telemetry = initBrowserTelemetry({ endpoint: "/api/telemetry", routes });
    return (): void => {
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
