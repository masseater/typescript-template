import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import type { UsersSearch } from "#users-search.ts";
import { normalizeUsersSearch } from "#users-search.ts";
import { useMemo } from "react";

const baseClassName =
  "inline-flex min-w-8 items-center justify-center rounded-md border px-2 py-1 text-base leading-tight outline-none focus-visible:focus-indicator";
const currentClassName = `${baseClassName} border-primary bg-primary text-primary-foreground`;
const otherClassName = `${baseClassName} border-border bg-card text-foreground hover:bg-card-hover`;

function PageLink({
  current,
  label,
  page,
  search,
  text,
}: Readonly<{
  current: boolean;
  label: string;
  page: number;
  search: UsersSearch;
  text: string;
}>): ReactElement {
  const target = useMemo(() => normalizeUsersSearch({ ...search, page }), [page, search]);
  return (
    <li>
      <Link
        to="/"
        search={target}
        aria-label={label}
        aria-current={current ? "page" : undefined}
        className={current ? currentClassName : otherClassName}
      >
        {text}
      </Link>
    </li>
  );
}

export { PageLink };
