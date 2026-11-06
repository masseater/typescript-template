import { treaty } from "@elysiajs/eden";
import type { Treaty } from "@elysiajs/eden";
import { run } from "@r_masseater/workers-tracing/effect";
import { createEdenOptionsProxy } from "eden-tanstack-react-query";
import type { EdenOptionsProxy } from "eden-tanstack-react-query";
import { Effect } from "effect";
import type { AnyElysia } from "elysia";

const SERVER_ORIGIN = "http://localhost";

const serverClient = <App extends AnyElysia>(
  load: () => Promise<(request: Request) => Promise<Response>>,
): Treaty.Create<App> =>
  treaty<App>(SERVER_ORIGIN, {
    fetcher: (input, init) =>
      run(
        Effect.promise(load).pipe(
          Effect.flatMap((handle) => Effect.promise(() => handle(new Request(input, init)))),
        ),
      ),
  });

const browserClient = <App extends AnyElysia>(): Treaty.Create<App> =>
  treaty<App>(globalThis.location.origin);

const createQueries = <App extends AnyElysia>(client: Treaty.Create<App>): EdenOptionsProxy<App> =>
  createEdenOptionsProxy<App>({ client });

export { browserClient, createQueries, serverClient };
