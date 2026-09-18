import { initBrowserTelemetry } from "@repo/observability/browser";
import { HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";

import { routes } from "#shared/telemetry/index.ts";
import { WikiProvider } from "./-wiki-provider.tsx";

import type { ReactElement } from "react";

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
