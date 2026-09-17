import { DocumentBody } from "#components/document-body.tsx";
import { HeadContent } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { connectBrowserSentry } from "@template/observability/sentry-browser";
import { initBrowserTelemetry } from "@template/observability/browser";
import { routes } from "#telemetry-routes.ts";
import { useEffect } from "react";

function RootDocument(): ReactElement {
  useEffect(() => {
    const telemetry = initBrowserTelemetry({ endpoint: "/api/telemetry", routes });
    const disconnectSentry = connectBrowserSentry();
    return (): void => {
      disconnectSentry();
      telemetry.dispose();
    };
  }, []);
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <DocumentBody />
    </html>
  );
}

export { RootDocument };
