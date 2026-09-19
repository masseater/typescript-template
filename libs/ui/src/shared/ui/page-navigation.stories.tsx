import preview from "../../../storybook/preview";
import { PageNavigation, type PageTarget } from "./page-navigation";
import { PaginationLink } from "./pagination-link";

import type { ReactElement } from "react";

const renderLink = (pageTarget: Readonly<PageTarget>): ReactElement => {
  return (
    <PaginationLink to="/" aria-label={pageTarget.label} current={pageTarget.current}>
      {pageTarget.text}
    </PaginationLink>
  );
};

const meta = preview.meta({
  args: { current: 1, last: 12, renderLink },
  component: PageNavigation,
});

export const FirstPage = meta.story();

export const MiddlePage = meta.story({ args: { current: 6 } });

export const LastPage = meta.story({ args: { current: 12 } });

export const SinglePage = meta.story({ args: { last: 1 } });
