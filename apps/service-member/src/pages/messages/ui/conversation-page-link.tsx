import { PaginationLink } from "@repo/ui";

import { pageSearch } from "#pages/messages/model/messages-search.ts";

import type { PageTarget } from "@repo/ui";
import type { ReactElement } from "react";

function ConversationPageLink({
  conversationId,
  target,
}: Readonly<{ conversationId: string; target: PageTarget }>): ReactElement {
  return (
    <PaginationLink
      to="/messages/$id"
      params={{ id: conversationId }}
      search={pageSearch(target.page)}
      current={target.current}
      aria-label={target.label}
    >
      {target.text}
    </PaginationLink>
  );
}

export { ConversationPageLink };
