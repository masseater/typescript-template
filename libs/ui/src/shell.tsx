import { HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { initBrowserTelemetry } from "@template/observability/browser";
import { Fragment, useEffect } from "react";
import type { ReactElement } from "react";
import { UIProvider } from "./primitives";

export function appHead(title: string, stylesheet: string) {
  return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title },
    ],
    links: [{ rel: "stylesheet", href: stylesheet }],
  };
}

export function AppShell({
  navigation,
  routes,
}: {
  navigation: readonly { href: string; label: string }[];
  routes: Readonly<Record<string, string>>;
}): ReactElement {
  useEffect(() => {
    const telemetry = initBrowserTelemetry({ endpoint: "/api/telemetry", routes });
    return () => {
      telemetry.dispose();
    };
  }, [routes]);
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        <UIProvider>
          <nav aria-label="メイン">
            {navigation.map((link, index) => (
              <Fragment key={link.href}>
                {index > 0 && " "}
                <a href={link.href}>{link.label}</a>
              </Fragment>
            ))}
          </nav>
          <Outlet />
        </UIProvider>
        <Scripts />
      </body>
    </html>
  );
}
