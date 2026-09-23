import "./temporal.ts";
import { initBrowserTelemetry } from "@repo/observability/browser";
import { HeadContent } from "@tanstack/react-router";
import { useEffect, type ReactElement } from "react";

import { AppBody } from "./app-body";

import type { Children } from "./shared/ui/types";

const AppShell = ({
  children,
  lang = "ja",
  routes,
  themedDocument = false,
}: Children &
  Readonly<{
    lang?: string;
    routes: Readonly<Record<string, string>>;
    themedDocument?: boolean;
  }>): ReactElement => {
  useEffect(() => {
    const telemetry = initBrowserTelemetry({ endpoint: "/api/telemetry", routes });
    return (): void => {
      telemetry.dispose();
    };
  }, [routes]);
  return (
    <html lang={lang} suppressHydrationWarning={themedDocument}>
      <head>
        <HeadContent />
      </head>
      <AppBody>{children}</AppBody>
    </html>
  );
};

export { AppShell };
