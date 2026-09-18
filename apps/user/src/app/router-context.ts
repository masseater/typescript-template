import type { DbClient } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";

interface RouterContext {
  readonly dbClient: DbClient;
  readonly queryClient: QueryClient;
}

export type { RouterContext };
