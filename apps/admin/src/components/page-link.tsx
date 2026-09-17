import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import type { UsersSearch } from "#users-search.ts";
import { normalizeUsersSearch } from "#users-search.ts";
import { useMemo } from "react";

const baseClassName =
  "inline-flex min-w-8 items-center justify-center rounded-md border px-2 py-1 text-base leading-tight outline-none focus-visible:focus-indicator";
const activeProps = { className: "border-primary bg-primary text-primary-foreground" } as const;
const inactiveProps = {
  className: "border-border bg-card text-foreground hover:bg-card-hover",
} as const;
const exactMatch = { exact: true, includeSearch: true } as const;

function PageLink({
  label,
  page,
  search,
  text,
}: Readonly<{ label: string; page: number; search: UsersSearch; text: string }>): ReactElement {
  const target = useMemo(() => normalizeUsersSearch({ ...search, page }), [page, search]);
  return (
    <li>
      <Link
        to="/"
        search={target}
        activeOptions={exactMatch}
        activeProps={activeProps}
        inactiveProps={inactiveProps}
        aria-label={label}
        className={baseClassName}
      >
        {text}
      </Link>
    </li>
  );
}

export { PageLink };
