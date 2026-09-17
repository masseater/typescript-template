import { Effect, Schema } from "effect";
import { CloudflareFailure } from "./config.ts";

const REQUEST_TIMEOUT_MS = 30_000;
const NOT_FOUND_STATUS = 404;

interface AccountAccess {
  readonly accountId: string;
  readonly apiToken: string;
}

interface Reading {
  readonly body: unknown;
  readonly found: boolean;
}

function unreadable(): CloudflareFailure {
  return new CloudflareFailure({ code: "account_read_unavailable", keys: [] });
}

const readJson = Effect.fn("readJson")(function* readJson(
  apiToken: string,
  path: string,
  query: Readonly<Record<string, string>> = {},
) {
  const endpoint = new URL(`https://api.cloudflare.com/client/v4/${path}`);
  for (const [name, value] of Object.entries(query)) {
    endpoint.searchParams.set(name, value);
  }
  const response = yield* Effect.tryPromise({
    catch: unreadable,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    try: async (signal) =>
      fetch(endpoint, {
        headers: { authorization: `Bearer ${apiToken}` },
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
      }),
  });
  if (response.status === NOT_FOUND_STATUS) {
    return { body: undefined, found: false } satisfies Reading;
  }
  if (!response.ok) {
    return yield* Effect.fail(unreadable());
  }
  const body = yield* Effect.tryPromise({
    catch: unreadable,
    try: async (): Promise<unknown> => response.json(),
  });
  return { body, found: true } satisfies Reading;
});

const decodeBody = Effect.fn("decodeBody")(function* decodeBody<Shape, Encoded>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  shape: Schema.Codec<Shape, Encoded>,
  body: unknown,
) {
  return yield* Schema.decodeUnknownEffect(shape)(body).pipe(Effect.mapError(unreadable));
});

const readDecoded = Effect.fn("readDecoded")(function* readDecoded<Shape, Encoded>(
  access: AccountAccess,
  path: string,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  shape: Schema.Codec<Shape, Encoded>,
) {
  const reading = yield* readJson(access.apiToken, path);
  return reading.found ? yield* decodeBody(shape, reading.body) : undefined;
});

export { decodeBody, readDecoded, readJson, unreadable };
export type { AccountAccess };
