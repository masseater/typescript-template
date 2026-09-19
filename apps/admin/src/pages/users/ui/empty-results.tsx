import { StatusMessage, TextLink } from "@repo/ui";
import { omit } from "es-toolkit";

import type { UsersSearch } from "#pages/users/model/users-search.ts";
import type { ReactElement } from "react";

function EmptyResults({
  beyondLastPage,
  search,
}: Readonly<{ beyondLastPage: boolean; search: UsersSearch }>): ReactElement {
  const target = beyondLastPage ? omit(search, ["page"]) : {};
  return (
    <div className="flex flex-col items-start gap-2">
      <StatusMessage>
        {beyondLastPage
          ? "このページに該当するユーザーはいません。"
          : "条件に一致するユーザーはいません。"}
      </StatusMessage>
      <TextLink to="/" search={target}>
        {beyondLastPage ? "1 ページ目へ" : "条件をクリア"}
      </TextLink>
    </div>
  );
}

export { EmptyResults };
