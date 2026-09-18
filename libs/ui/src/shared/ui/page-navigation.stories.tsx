import preview from "../../../.storybook/preview";
import { PageNavigation, type PageTarget } from "./page-navigation";
import { PaginationLink } from "./pagination-link";

import type { ReactElement } from "react";

const renderLink = (target: Readonly<PageTarget>): ReactElement => {
  return (
    <PaginationLink to="/" aria-label={target.label} current={target.current}>
      {target.text}
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
