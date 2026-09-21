import { queryOptions } from "@tanstack/react-query";

const userListKey = ["admin-users"] as const;

function userListOptions<Result>(
  query: Readonly<Record<string, string>>,
  queryFn: () => Promise<Result>,
) {
  return queryOptions({
    queryFn,
    queryKey: [...userListKey, query] as const,
    retry: false,
  });
}

export { userListKey, userListOptions };
