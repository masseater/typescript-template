import { Duration, Effect } from "effect";
import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import type { AnyRouter } from "@tanstack/react-router";
import type { RequestFailed } from "./request";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

const optionsOf = Symbol("ServerQuery");

interface ServerQuery<Value> {
  readonly [optionsOf]: () => UseQueryOptions<Value, RequestFailed>;
}

type ServerQueryResult<Value> = Readonly<
  | { message: string; status: "failure" }
  | { status: "pending" }
  | { status: "success"; value: Value }
>;

function serverQuery<Value>(
  queryKey: QueryKey,
  program: Effect.Effect<Value, RequestFailed>,
): ServerQuery<Value> {
  return {
    [optionsOf]: () => ({
      queryFn: async ({ signal }) => Effect.runPromise(program, { signal }),
      queryKey,
    }),
  };
}

function useServerQuery<Value>(query: ServerQuery<Value>): ServerQueryResult<Value> {
  const result = useQuery(query[optionsOf]());
  if (result.isError) {
    return { message: result.error.message, status: "failure" };
  }
  return result.isPending ? { status: "pending" } : { status: "success", value: result.data };
}

function useRefresh(): (queryKey: QueryKey) => void {
  const queryClient = useQueryClient();
  return (queryKey) => {
    void queryClient.invalidateQueries({ queryKey });
  };
}

function withServerQueries<Router extends AnyRouter>(router: Router): Router {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Duration.toMillis(Duration.minutes(1)) } },
  });
  setupRouterSsrQueryIntegration({ queryClient, router });
  return router;
}

export { serverQuery, useRefresh, useServerQuery, withServerQueries };
export type { ServerQuery, ServerQueryResult };
