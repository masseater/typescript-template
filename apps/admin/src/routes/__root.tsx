import { createRootRoute } from "@tanstack/react-router";
import { AppShell, appHead } from "@template/ui/shell";
import styles from "@template/ui/styles.css?url";
import { routes } from "../telemetry-routes.ts";

const navigation = [
  { href: "/", label: "ユーザー管理" },
  { href: "/security", label: "認証設定" },
  { href: "/login", label: "ログイン" },
] as const;

export const Route = createRootRoute({
  head: () => appHead("管理者アプリ", styles),
  component: () => <AppShell navigation={navigation} routes={routes} />,
});
