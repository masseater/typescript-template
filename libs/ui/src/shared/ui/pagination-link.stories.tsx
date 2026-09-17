import { RouterContextProvider, createRootRoute, createRouter } from "@tanstack/react-router";
import { PaginationLink } from "./pagination-link";
import type { ReactElement } from "react";
import preview from "../../../.storybook/preview";

const router = createRouter({ routeTree: createRootRoute() });

const meta = preview.meta({
  args: { children: "2", current: false, to: "/" },
  component: PaginationLink,
  render: ({ children, current, to }): ReactElement => (
    <RouterContextProvider router={router}>
      <PaginationLink to={to ?? "/"} current={current === true}>
        {children}
      </PaginationLink>
    </RouterContextProvider>
  ),
});

export const Other = meta.story();

export const Current = meta.story({ args: { current: true } });
