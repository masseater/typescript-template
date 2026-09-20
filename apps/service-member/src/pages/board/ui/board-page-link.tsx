import { PaginationLink } from "@repo/ui";

import { pageSearch } from "#pages/board/model/board-search.ts";

import type { PageTarget } from "@repo/ui";
import type { ReactElement } from "react";

function BoardPageLink({ target }: Readonly<{ target: PageTarget }>): ReactElement {
  return (
    <PaginationLink
      to="/board"
      search={pageSearch(target.page)}
      current={target.current}
      aria-label={target.label}
    >
      {target.text}
    </PaginationLink>
  );
}

export { BoardPageLink };
