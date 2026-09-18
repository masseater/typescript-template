import { HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { useEffect } from "react";

import { routes } from "#shared/telemetry/index.ts";
import { initBrowserTelemetry } from "@repo/observability/browser";

import { WikiProvider } from "./-wiki-provider.tsx";

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
      <body className="flex min-h-svh flex-col">
        <WikiProvider />
        <Scripts />
      </body>
    </html>
  );
}

export { RootDocument };
