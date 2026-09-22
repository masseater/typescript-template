import { TextLink } from "@repo/ui";

import type { MessagesSearch } from "#pages/messages/model/messages-search.ts";
import type { PageTarget } from "@repo/ui";
import type { ReactElement } from "react";

function MessagesPageLink({ target }: Readonly<{ target: PageTarget }>): ReactElement {
  const search: MessagesSearch = target.page <= 1 ? {} : { page: target.page };
  return (
    <TextLink to="/messages" search={search}>
      {target.page}
    </TextLink>
  );
}

export { MessagesPageLink };
