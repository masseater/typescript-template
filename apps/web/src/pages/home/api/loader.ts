import type { QueryClient } from "@tanstack/react-query";

import { todoQueries } from "./queries";

export const loadHomePage = (queryClient: QueryClient) =>
  queryClient.ensureQueryData(todoQueries.api.todos.get.queryOptions());
