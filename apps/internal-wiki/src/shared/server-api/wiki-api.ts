import { WikiPageNotFound, WikiRpcs, createRpcFetcher } from "@repo/core-api";
import { WorkerEntrypoint } from "cloudflare:workers";
import { Effect } from "effect";

import { source } from "#shared/content/index.ts";
import { runtime } from "./runtime.ts";
import { maximumQueryLength } from "./search-query.ts";
import { searchWiki, wikiLlms } from "./search.ts";

const handlers = WikiRpcs.toLayer({
  listWikiPages: () => Effect.promise(() => Promise.resolve(wikiLlms.index())),
  readWikiPage: ({ url }: Readonly<{ url: string }>) => {
    const page = source.getPageByUrl(url);
    return page === undefined
      ? Effect.fail(WikiPageNotFound.make({ url }))
      : Effect.promise(() => wikiLlms.page(page));
  },
  searchWiki: ({ query }: Readonly<{ query: string }>) =>
    Effect.promise(() => runtime.runPromise(searchWiki(query.slice(0, maximumQueryLength)))),
});

class WikiApi extends WorkerEntrypoint {
  public override fetch(request: Request): Promise<Response> {
    const rpc = createRpcFetcher(WikiRpcs, handlers);
    return Effect.runPromise(
      Effect.gen(function* serveRpc() {
        const response = yield* Effect.promise(() => rpc.fetch(request));
        const body = yield* Effect.promise(() => response.arrayBuffer());
        yield* Effect.promise(() => rpc.dispose());
        return new Response(body, { headers: response.headers, status: response.status });
      }),
    );
  }
}

export { WikiApi };
