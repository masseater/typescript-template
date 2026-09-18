import { Effect, Schema } from "effect";
import { CloudflareFailure } from "./config.ts";

const REQUEST_TIMEOUT_MS = 30_000;
const NOT_FOUND_STATUS = 404;
const PAGE_SIZE = 1000;

interface AccountAccess {
  readonly accountId: string;
  readonly apiToken: string;
}

type Query = Readonly<Record<string, string>>;

const Paged = Schema.Struct({
  result: Schema.Array(Schema.Unknown),
  result_info: Schema.optional(Schema.Struct({ total_count: Schema.Number })),
});

function unreadable(): CloudflareFailure {
  return new CloudflareFailure({ code: "account_read_unavailable", keys: [] });
}

const fetchJson = Effect.fn("fetchJson")(function* fetchJson(
  apiToken: string,
  path: string,
  query: Query,
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
    return { body: undefined, found: false };
  }
  if (!response.ok) {
    return yield* Effect.fail(unreadable());
  }
  const body = yield* Effect.tryPromise({
    catch: unreadable,
    try: async (): Promise<unknown> => response.json(),
  });
  return { body, found: true };
});

const decodeBody = Effect.fn("decodeBody")(function* decodeBody<Shape, Encoded>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  shape: Schema.Codec<Shape, Encoded>,
  body: unknown,
) {
  return yield* Schema.decodeUnknownEffect(shape)(body).pipe(Effect.mapError(unreadable));
});

const readResource = Effect.fn("readResource")(function* readResource<Shape, Encoded>(
  access: AccountAccess,
  path: string,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  shape: Schema.Codec<Shape, Encoded>,
) {
  const reading = yield* fetchJson(access.apiToken, path, {});
  return reading.found ? yield* decodeBody(shape, reading.body) : undefined;
});

const readList = Effect.fn("readList")(function* readList<Shape, Encoded>(
  access: AccountAccess,
  collection: Readonly<{ path: string; query?: Query }>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  shape: Schema.Codec<Shape, Encoded>,
) {
  const reading = yield* fetchJson(access.apiToken, collection.path, {
    ...collection.query,
    per_page: String(PAGE_SIZE),
  });
  if (!reading.found) {
    return yield* Effect.fail(unreadable());
  }
  const paged = yield* decodeBody(Paged, reading.body);
  const total = paged.result_info?.total_count;
  if (total !== undefined && total !== paged.result.length) {
    return yield* Effect.fail(unreadable());
  }
  return yield* decodeBody(shape, reading.body);
});

export { decodeBody, readList, readResource, unreadable };
export type { AccountAccess };
