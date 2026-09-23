import { TextLink } from "@repo/ui";

import type { ConversationSearch } from "#pages/messages/model/messages-search.ts";
import type { PageTarget } from "@repo/ui";
import type { ReactElement } from "react";

function ConversationPageLink({
  conversationId,
  target,
}: Readonly<{ conversationId: string; target: PageTarget }>): ReactElement {
  const search: ConversationSearch = target.page <= 1 ? {} : { page: target.page };
  return (
    <TextLink to="/messages/$id" params={{ id: conversationId }} search={search}>
      {target.page}
    </TextLink>
  );
}

export { ConversationPageLink };
