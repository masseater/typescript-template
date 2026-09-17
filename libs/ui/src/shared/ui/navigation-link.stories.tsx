import { RouterContextProvider, createRootRoute, createRouter } from "@tanstack/react-router";
import { NavigationLink } from "./navigation-link";
import type { ReactElement } from "react";
import preview from "../../../.storybook/preview";

const router = createRouter({ routeTree: createRootRoute() });

const meta = preview.meta({
  args: { children: "ホーム", to: "/", variant: "item" },
  component: NavigationLink,
  render: ({ children, to, variant }): ReactElement => (
    <RouterContextProvider router={router}>
      <NavigationLink to={to ?? "/"} variant={variant ?? "item"}>
        {children}
      </NavigationLink>
    </RouterContextProvider>
  ),
});

export const Item = meta.story();

export const Brand = meta.story({ args: { children: "Template", variant: "brand" } });
