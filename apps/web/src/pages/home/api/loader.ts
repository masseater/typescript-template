import type { QueryClient } from "@tanstack/react-query";

import { todoQueries } from "./queries";

const loadHomePage = (queryClient: QueryClient): Promise<unknown> =>
  queryClient.query({ ...todoQueries.api.todos.get.queryOptions(), staleTime: "static" });

export { loadHomePage };
