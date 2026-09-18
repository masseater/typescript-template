import { omit } from "es-toolkit";
import type { ReactElement } from "react";

import type { UsersSearch } from "#pages/users/model/users-search.ts";
import { Status, TextLink } from "@repo/ui";

function EmptyResults({
  beyondLastPage,
  search,
}: Readonly<{ beyondLastPage: boolean; search: UsersSearch }>): ReactElement {
  const target = beyondLastPage ? omit(search, ["page"]) : {};
  return (
    <div className="flex flex-col items-start gap-2">
      <Status>
        {beyondLastPage
          ? "このページに該当するユーザーはいません。"
          : "条件に一致するユーザーはいません。"}
      </Status>
      <TextLink to="/" search={target}>
        {beyondLastPage ? "1 ページ目へ" : "条件をクリア"}
      </TextLink>
    </div>
  );
}

export { EmptyResults };
