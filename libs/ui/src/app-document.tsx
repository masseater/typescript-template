import { HeadContent, Scripts } from "@tanstack/react-router";
import type { Children } from "./shared/ui/types";
import type { ReactElement } from "react";
import { initBrowserTelemetry } from "@template/observability/browser";
import { useEffect } from "react";

type AppDocumentProps = Children & Readonly<{ routes: Readonly<Record<string, string>> }>;

function AppDocument({ children, routes }: AppDocumentProps): ReactElement {
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
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

export { AppDocument };
