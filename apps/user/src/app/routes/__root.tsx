import { AppNavigation, AppShell, appHead } from "@template/ui/shell";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { routes } from "#app/telemetry-routes.ts";
import styles from "#app/styles.css?url";

const navigation = [
  { href: "/", label: "プロフィール" },
  { href: "/security", label: "認証設定" },
  { href: "/login", label: "ログイン" },
] as const;

const Route = createRootRoute({
  component: (): ReactElement => (
    <AppShell routes={routes}>
      <AppNavigation links={navigation} />
      <Outlet />
    </AppShell>
  ),
  head: () => appHead("ユーザーアプリ", styles),
});

export { Route };
