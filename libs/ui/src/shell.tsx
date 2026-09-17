import { HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { initBrowserTelemetry } from "@template/observability/browser";
import { useEffect } from "react";
import type { ReactElement } from "react";

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
        <nav aria-label="メイン" className="border-b border-border bg-card shadow-sm">
          <ul className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-4 p-4">
            {navigation.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="focus-visible:focus-indicator-outer">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
