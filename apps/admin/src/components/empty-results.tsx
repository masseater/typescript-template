import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { Status } from "@template/ui/ui";
import type { UsersSearch } from "#users-search.ts";
import { normalizeUsersSearch } from "#users-search.ts";
import { useMemo } from "react";

const linkClassName = "text-link underline hover:text-link-hover";

function EmptyResults({
  beyondLastPage,
  search,
}: Readonly<{ beyondLastPage: boolean; search: UsersSearch }>): ReactElement {
  const target = useMemo(
    () => (beyondLastPage ? normalizeUsersSearch({ ...search, page: 1 }) : {}),
    [beyondLastPage, search],
  );
  return (
    <div className="flex flex-col items-start gap-2">
      <Status>
        {beyondLastPage
          ? "このページに該当するユーザーはいません。"
          : "条件に一致するユーザーはいません。"}
      </Status>
      <Link to="/" search={target} className={linkClassName}>
        {beyondLastPage ? "1 ページ目へ" : "条件をクリア"}
      </Link>
    </div>
  );
}

export { EmptyResults };
