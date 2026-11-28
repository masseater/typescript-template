import type { QueryClient } from "@tanstack/react-query";

import { todoQueries } from "./queries.ts";
import { todoSummaryQuery } from "./summary.tsx";

export const loadHomePage = (queryClient: QueryClient): Promise<unknown> =>
  Promise.all([
    queryClient.query({ ...todoQueries.api.todos.get.queryOptions(), staleTime: "static" }),
    queryClient.query({ ...todoSummaryQuery, staleTime: "static" }),
  ]);
