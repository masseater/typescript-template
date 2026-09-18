import { Link } from "@tanstack/react-router";
import { MemberCard } from "./member-card.tsx";
import type { ReactElement } from "react";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import { useMemberList } from "#pages/users/model/use-member-list.ts";

function Results({ search }: Readonly<{ search: UsersSearch }>): ReactElement {
  const { items, listHeight, listRef, loading, measure, members, scrollMargin, total } =
    useMemberList(search);
  if (total === 0) {
    return (
      <p className="text-base leading-normal">
        条件に一致するユーザーはいません。<Link to="/users">条件を外す</Link>
      </p>
    );
  }
  return (
    <>
      <p className="text-sm leading-normal text-muted-foreground">
        {total} 人中 {members.length} 人を表示
      </p>
      <ul ref={listRef} className="relative w-full" style={{ height: listHeight }}>
        {items.map((item) => (
          <MemberCard
            key={item.key}
            member={members[item.index]}
            measure={measure}
            index={item.index}
            offset={item.start - scrollMargin}
          />
        ))}
      </ul>
      {loading && (
        <p className="text-sm leading-normal text-muted-foreground">読み込んでいます。</p>
      )}
    </>
  );
}

export { Results };
