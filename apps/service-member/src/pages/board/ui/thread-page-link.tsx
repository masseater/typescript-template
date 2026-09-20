import { PaginationLink } from "@repo/ui";

import { pageSearch } from "#pages/board/model/board-search.ts";

import type { PageTarget } from "@repo/ui";
import type { ReactElement } from "react";

function ThreadPageLink({
  target,
  threadId,
}: Readonly<{ target: PageTarget; threadId: string }>): ReactElement {
  return (
    <PaginationLink
      to="/board/$id"
      params={{ id: threadId }}
      search={pageSearch(target.page)}
      current={target.current}
      aria-label={target.label}
    >
      {target.text}
    </PaginationLink>
  );
}

export { ThreadPageLink };
