import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { initBrowserTelemetry } from "@template/observability/browser";
import { UIProvider } from "@template/ui";
import styles from "@template/ui/styles.css?url";
import { useEffect } from "react";
import { routes } from "../telemetry-routes.ts";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ユーザーアプリ" },
    ],
    links: [{ rel: "stylesheet", href: styles }],
  }),
  component: Root,
});

function Root() {
  useEffect(() => {
    const telemetry = initBrowserTelemetry({ endpoint: "/api/telemetry", routes });
    return () => {
      telemetry.dispose();
    };
  }, []);
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        <UIProvider>
          <nav aria-label="メイン">
            <a href="/">プロフィール</a> <a href="/security">認証設定</a>{" "}
            <a href="/login">ログイン</a>
          </nav>
          <Outlet />
        </UIProvider>
        <Scripts />
      </body>
    </html>
  );
}
