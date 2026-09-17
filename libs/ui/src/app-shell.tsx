import { AppDocument } from "./app-document";
import { AppNavigation } from "./app-navigation";
import type { NavigationLink } from "./app-navigation";
import { Outlet } from "@tanstack/react-router";
import type { ReactElement } from "react";

function AppShell({
  navigation,
  routes,
}: Readonly<{
  navigation: readonly NavigationLink[];
  routes: Readonly<Record<string, string>>;
}>): ReactElement {
  return (
    <AppDocument routes={routes}>
      <AppNavigation links={navigation} />
      <Outlet />
    </AppDocument>
  );
}

export { AppShell };
