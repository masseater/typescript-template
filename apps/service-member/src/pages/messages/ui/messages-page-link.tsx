import { PaginationLink } from "@repo/ui";

import { listPageSearch } from "#pages/messages/model/messages-search.ts";

import type { PageTarget } from "@repo/ui";
import type { ReactElement } from "react";

function MessagesPageLink({
  peer,
  target,
}: Readonly<{ peer: string | undefined; target: PageTarget }>): ReactElement {
  return (
    <PaginationLink
      to="/messages"
      search={listPageSearch(target.page, peer)}
      current={target.current}
      aria-label={target.label}
    >
      {target.text}
    </PaginationLink>
  );
}

export { MessagesPageLink };
