import { AppShell, appHead } from "@template/ui/shell";
import type { ReactElement } from "react";
import { createRootRoute } from "@tanstack/react-router";
import { routes } from "#telemetry-routes.ts";
import styles from "@template/ui/styles.css?url";

const navigation = [
  { href: "/", label: "プロフィール" },
  { href: "/security", label: "認証設定" },
  { href: "/login", label: "ログイン" },
] as const;

const Route = createRootRoute({
  component: (): ReactElement => <AppShell navigation={navigation} routes={routes} />,
  head: () => appHead("ユーザーアプリ", styles),
});

export { Route };
