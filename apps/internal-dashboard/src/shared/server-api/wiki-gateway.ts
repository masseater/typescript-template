import { httpStatus, readWikiBindings, wikiBasePath, wikiPagesBinding } from "@repo/config";
import { CurrentRequest } from "@repo/observability";
import { env } from "cloudflare:workers";
import { Effect, Option } from "effect";

import { guardAccess } from "./access.ts";

const credentialHeaders = ["authorization", "cookie"] as const;

function wikiRoot(request: Request): Response {
  const url = new URL(request.url);
  return new Response(undefined, {
    headers: { location: `${wikiBasePath}/${url.search}` },
    status: httpStatus.permanentRedirect,
  });
}

function forwarded(request: Request, traceparent: string): Request {
  const headers = new Headers(request.headers);
  for (const header of credentialHeaders) {
    headers.delete(header);
  }
  headers.set("traceparent", traceparent);
  return new Request(request, { headers });
}

const forwardWiki = Effect.fn("forwardWiki")(function* forwardWiki(request: Request, path: string) {
  const denial = yield* guardAccess(request, path).pipe(Effect.orDie);
  if (Option.isSome(denial)) {
    return denial.value;
  }
  if (path === wikiBasePath) {
    return wikiRoot(request);
  }
  const bindings = yield* readWikiBindings(env).pipe(Effect.orDie);
  const { traceparent } = yield* CurrentRequest;
  return yield* Effect.promise(() =>
    bindings[wikiPagesBinding].fetch(forwarded(request, traceparent)),
  );
});

export { forwardWiki };
