import { RouterContextProvider, createRootRoute, createRouter } from "@tanstack/react-router";
import { CardLink } from "./card-link";
import { Heading } from "./heading";
import type { ReactElement } from "react";
import preview from "../../../.storybook/preview";

const router = createRouter({ routeTree: createRootRoute() });

const meta = preview.meta({
  args: { children: <Heading size="block">認証設定</Heading>, to: "/" },
  component: CardLink,
  render: ({ children, to }): ReactElement => (
    <RouterContextProvider router={router}>
      <CardLink to={to ?? "/"}>{children}</CardLink>
    </RouterContextProvider>
  ),
});

export const Default = meta.story();
