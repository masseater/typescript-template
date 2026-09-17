import { AppBody } from "./app-body";
import { HeadContent } from "@tanstack/react-router";
import type { NavigationLink } from "./app-navigation";
import type { ReactElement } from "react";
import { initBrowserTelemetry } from "@template/observability/browser";
import { useEffect } from "react";

function AppShell({
  navigation,
  routes,
}: Readonly<{
  navigation: readonly NavigationLink[];
  routes: Readonly<Record<string, string>>;
}>): ReactElement {
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
      <AppBody navigation={navigation} />
    </html>
  );
}

export { AppShell };
