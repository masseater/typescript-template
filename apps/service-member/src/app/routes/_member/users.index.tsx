import { createFileRoute, redirect } from "@tanstack/react-router";

import { normalizeUsersSearch } from "#pages/users/index.ts";

import type { UsersSearch } from "#pages/users/index.ts";

const Route = createFileRoute("/_member/users/")({
  beforeLoad: ({ search }: Readonly<{ search: UsersSearch }>) => {
    throw redirect({ replace: true, search: normalizeUsersSearch(search), to: "/search" });
  },
});

export { Route };
