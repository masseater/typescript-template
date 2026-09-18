import { PageNavigation, TextLink } from "@template/ui";

import { MemberCard } from "./member-card.tsx";
import { MemberPageLink } from "./member-page-link.tsx";

import type { Members } from "#pages/users/api/load-members.ts";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import type { PageTarget } from "@template/ui";
import type { ReactElement } from "react";

const Results = ({
  list,
  search,
}: Readonly<{ list: Members; search: UsersSearch }>): ReactElement => {
  const pageLink = (target: PageTarget): ReactElement => {
    return <MemberPageLink search={search} target={target} />;
  };
  const current = search.page ?? 1;
  const first = (current - 1) * list.pageSize + 1;
  if (list.total === 0) {
    return (
      <p className="text-base leading-normal">
        条件に一致するユーザーはいません。<TextLink to="/users">条件を外す</TextLink>
      </p>
    );
  }
  if (list.members.length === 0) {
    return (
      <p className="text-base leading-normal">
        このページに該当するユーザーはいません。
        <TextLink
          to="/users"
          search={search.keyword === undefined ? {} : { keyword: search.keyword }}
        >
          1 ページ目へ
        </TextLink>
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
        renderLink={pageLink}
      />
    </>
  );
};

export { Results };
