import { RouterContextProvider, createRootRoute, createRouter } from "@tanstack/react-router";
import { ButtonLink } from "./button-link";
import type { ReactElement } from "react";
import preview from "../../../.storybook/preview";

const router = createRouter({ routeTree: createRootRoute() });

const meta = preview.meta({
  args: { children: "無料で始める", size: "medium", to: "/", variant: "secondary" },
  component: ButtonLink,
  render: ({ children, size, to, variant }): ReactElement => (
    <RouterContextProvider router={router}>
      <ButtonLink to={to ?? "/"} size={size ?? "medium"} variant={variant ?? "secondary"}>
        {children}
      </ButtonLink>
    </RouterContextProvider>
  ),
});

export const Primary = meta.story({ args: { size: "large", variant: "primary" } });

export const Secondary = meta.story();
