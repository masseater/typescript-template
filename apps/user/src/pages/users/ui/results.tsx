import { MemberRow } from "./member-row.tsx";
import type { ReactElement } from "react";
import { TextLink } from "@template/ui";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import { useMemberList } from "#pages/users/model/use-member-list.ts";

function Results({ search }: Readonly<{ search: UsersSearch }>): ReactElement {
  const { listHeight, listRef, loading, measure, rows, shown, total } = useMemberList(search);
  if (total === 0) {
    return (
      <p className="text-base leading-normal">
        条件に一致するユーザーはいません。<TextLink to="/users">条件を外す</TextLink>
      </p>
    );
  }
  return (
    <>
      <p className="text-sm leading-normal text-muted-foreground">
        {total} 人中 {shown} 人を表示
      </p>
      <ul ref={listRef} className="relative w-full" style={{ height: listHeight }}>
        {rows.map((row) => (
          <MemberRow key={row.item.key} row={row} measure={measure} />
        ))}
      </ul>
      {loading && (
        <p className="text-sm leading-normal text-muted-foreground">読み込んでいます。</p>
      )}
    </>
  );
}

export { Results };
