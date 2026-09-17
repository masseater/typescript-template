import { RouterContextProvider, createRootRoute, createRouter } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { TextLink } from "./text-link";
import preview from "../../../.storybook/preview";

const router = createRouter({ routeTree: createRootRoute() });

const meta = preview.meta({
  args: { children: "条件をクリア", to: "/" },
  component: TextLink,
  render: ({ children, to }): ReactElement => (
    <RouterContextProvider router={router}>
      <TextLink to={to ?? "/"}>{children}</TextLink>
    </RouterContextProvider>
  ),
});

export const Default = meta.story();
