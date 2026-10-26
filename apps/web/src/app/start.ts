import { createMiddleware, createStart } from "@tanstack/react-start";
import { Effect, Option, Record as Rec } from "effect";
import { Base64 } from "effect/encoding";

import {
  DOCUMENT_CACHE_CONTROL,
  SEARCH_INDEX_ORIGIN,
  SECURITY_HEADERS,
  contentSecurityPolicy,
} from "#/shared/config";

const NONCE_BYTES = 16;

const responseHeaders = createMiddleware().server(({ next }) =>
  Effect.runPromise(
    Effect.gen(function* secure() {
      const nonce = Base64.encode(crypto.getRandomValues(new Uint8Array(NONCE_BYTES)));
      const result = yield* Effect.promise(() => Promise.resolve(next({ context: { nonce } })));
      const secured = new Response(result.response.body, result.response);
      for (const [name, value] of Rec.toEntries(SECURITY_HEADERS)) {
        secured.headers.set(name, value);
      }
      secured.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
      secured.headers.set("Cache-Control", DOCUMENT_CACHE_CONTROL);
      if (Option.isNone(SEARCH_INDEX_ORIGIN)) {
        secured.headers.set("X-Robots-Tag", "noindex");
      }
      return { ...result, response: secured };
    }),
  ),
);

const startInstance = createStart(() => ({
  requestMiddleware: [responseHeaders],
}));

export { startInstance };
