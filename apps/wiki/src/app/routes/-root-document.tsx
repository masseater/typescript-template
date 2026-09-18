import { HeadContent, Scripts } from "@tanstack/react-router";
import { initBrowserTelemetry } from "@template/observability/browser";
import { useEffect, type ReactElement } from "react";

import { routes } from "#shared/telemetry/index.ts";
import { WikiProvider } from "./-wiki-provider.tsx";

const useBrowserTelemetry = (): void => {
  useEffect(() => {
    const telemetry = initBrowserTelemetry({ endpoint: "/api/telemetry", routes });
    return (): void => {
      telemetry.dispose();
    };
  }, []);
};

const RootDocument = (): ReactElement => {
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
};

export { RootDocument };
