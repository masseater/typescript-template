import { Outlet, Scripts } from "@tanstack/react-router";
import { AppNavigation } from "./app-navigation";
import type { NavigationLink } from "./app-navigation";
import type { ReactElement } from "react";
import { UIProvider } from "./ui-provider";

function AppBody({
  navigation,
}: Readonly<{ navigation: readonly NavigationLink[] }>): ReactElement {
  return (
    <body>
      <UIProvider>
        <AppNavigation links={navigation} />
        <Outlet />
      </UIProvider>
      <Scripts />
    </body>
  );
}

export { AppBody };
