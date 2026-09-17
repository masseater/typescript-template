import { Link } from "@tanstack/react-router";
import { MemberCard } from "./member-card.tsx";
import type { Members } from "#pages/users/api/load-members.ts";
import { PageNavigation } from "./page-navigation.tsx";
import type { ReactElement } from "react";
import type { UsersSearch } from "#pages/users/model/users-search.ts";

function Results({ list, search }: Readonly<{ list: Members; search: UsersSearch }>): ReactElement {
  const current = search.page ?? 1;
  const first = (current - 1) * list.pageSize + 1;
  if (list.total === 0) {
    return (
      <p className="text-base leading-normal">
        条件に一致するユーザーはいません。<Link to="/users">条件を外す</Link>
      </p>
    );
  }
  if (list.members.length === 0) {
    return (
      <p className="text-base leading-normal">
        このページに該当するユーザーはいません。
        <Link to="/users" search={search.keyword === undefined ? {} : { keyword: search.keyword }}>
          1 ページ目へ
        </Link>
      </p>
    );
  }
  return (
    <>
      <p className="text-sm leading-normal text-muted-foreground">
        {list.total} 人中 {first}〜{first + list.members.length - 1} 人
      </p>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.members.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </ul>
      <PageNavigation
        current={current}
        last={Math.ceil(list.total / list.pageSize)}
        search={search}
      />
    </>
  );
}

export { Results };
