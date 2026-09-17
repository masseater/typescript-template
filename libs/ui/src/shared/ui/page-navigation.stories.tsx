import { RouterContextProvider, createRootRoute, createRouter } from "@tanstack/react-router";
import { PageNavigation } from "./page-navigation";
import type { PageTarget } from "./page-navigation";
import { PaginationLink } from "./pagination-link";
import type { ReactElement } from "react";
import preview from "../../../.storybook/preview";

const router = createRouter({ routeTree: createRootRoute() });

function renderLink(target: Readonly<PageTarget>): ReactElement {
  return (
    <PaginationLink to="/" aria-label={target.label} current={target.current}>
      {target.text}
    </PaginationLink>
  );
}

const meta = preview.meta({
  args: { current: 1, last: 12, renderLink },
  component: PageNavigation,
  render: ({ current, last }): ReactElement => (
    <RouterContextProvider router={router}>
      <PageNavigation current={current} last={last} renderLink={renderLink} />
    </RouterContextProvider>
  ),
});

export const FirstPage = meta.story();

export const MiddlePage = meta.story({ args: { current: 6 } });

export const LastPage = meta.story({ args: { current: 12 } });

export const SinglePage = meta.story({ args: { last: 1 } });
