import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { initBrowserTelemetry } from "@template/observability/browser";
import { connectBrowserSentry } from "@template/observability/sentry-browser";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { useEffect } from "react";
import styles from "../styles/app.css?url";
import { translations } from "../lib/translations.ts";
import { routes } from "../telemetry-routes.ts";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Wiki" },
    ],
    links: [{ rel: "stylesheet", href: styles }],
  }),
  component: Root,
});

function Root() {
  useEffect(() => {
    const telemetry = initBrowserTelemetry({ endpoint: "/api/telemetry", routes });
    const disconnectSentry = connectBrowserSentry();
    return () => {
      disconnectSentry();
      telemetry.dispose();
    };
  }, []);
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider i18n={{ locale: "ja", translations }}>
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
