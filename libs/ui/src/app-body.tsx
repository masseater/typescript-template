import { Outlet, Scripts } from "@tanstack/react-router";
import { AppNavigation } from "./app-navigation";
import type { NavigationLink } from "./app-navigation";
import type { ReactElement } from "react";

function AppBody({
  navigation,
}: Readonly<{ navigation: readonly NavigationLink[] }>): ReactElement {
  return (
    <body>
      <AppNavigation links={navigation} />
      <Outlet />
      <Scripts />
    </body>
  );
}

export { AppBody };
