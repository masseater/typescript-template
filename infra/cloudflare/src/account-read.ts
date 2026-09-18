import { Effect, Predicate, Schema } from "effect";
import { CloudflareFailure } from "./config.ts";

const REQUEST_TIMEOUT_MS = 30_000;
const NOT_FOUND_STATUS = 404;

interface AccountAccess {
  readonly accountId: string;
  readonly apiToken: string;
}

type Query = Readonly<Record<string, string>>;
type Endpoint = Readonly<{ path: string; shape: string }>;

const PageInfo = Schema.Struct({ total_count: Schema.Number });
const Paged = Schema.Struct({
  result: Schema.Array(Schema.Unknown),
  result_info: Schema.optional(Schema.NullOr(PageInfo)),
});

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function endpoint(parts: TemplateStringsArray, ...values: readonly string[]): Endpoint {
  return { path: String.raw(parts, ...values), shape: parts.join("{}") };
}

function unreadable(source: Endpoint, reason: string): CloudflareFailure {
  return new CloudflareFailure({ code: "account_read_unavailable", keys: [source.shape, reason] });
}

function requestReason(error: unknown): string {
  return Predicate.hasProperty(error, "name") && error.name === "TimeoutError"
    ? "timeout"
    : "request_failed";
}

const fetchJson = Effect.fn("fetchJson")(function* fetchJson(
  apiToken: string,
  source: Endpoint,
  query: Query,
) {
  const url = new URL(`https://api.cloudflare.com/client/v4/${source.path}`);
  for (const [name, value] of Object.entries(query)) {
    url.searchParams.set(name, value);
  }
  const response = yield* Effect.tryPromise({
    catch: (error) => unreadable(source, requestReason(error)),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    try: async (signal) =>
      fetch(url, {
        headers: { authorization: `Bearer ${apiToken}` },
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
      }),
  });
  if (response.status === NOT_FOUND_STATUS) {
    return { body: undefined, found: false };
  }
  if (!response.ok) {
    return yield* Effect.fail(unreadable(source, `status_${response.status}`));
  }
  const body = yield* Effect.tryPromise({
    catch: () => unreadable(source, "decode_failed"),
    try: async (): Promise<unknown> => response.json(),
  });
  return { body, found: true };
});

const decodeBody = Effect.fn("decodeBody")(function* decodeBody<Shape, Encoded>(
  source: Endpoint,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  shape: Schema.Codec<Shape, Encoded>,
  body: unknown,
) {
  return yield* Schema.decodeUnknownEffect(shape)(body).pipe(
    Effect.mapError(() => unreadable(source, "decode_failed")),
  );
});

const readResource = Effect.fn("readResource")(function* readResource<Shape, Encoded>(
  access: AccountAccess,
  source: Endpoint,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  shape: Schema.Codec<Shape, Encoded>,
) {
  const reading = yield* fetchJson(access.apiToken, source, {});
  return reading.found ? yield* decodeBody(source, shape, reading.body) : undefined;
});

const readList = Effect.fn("readList")(function* readList<Shape, Encoded>(
  access: AccountAccess,
  collection: Readonly<{ query?: Query; source: Endpoint }>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  shape: Schema.Codec<Shape, Encoded>,
) {
  const reading = yield* fetchJson(access.apiToken, collection.source, collection.query ?? {});
  if (!reading.found) {
    return yield* Effect.fail(unreadable(collection.source, `status_${NOT_FOUND_STATUS}`));
  }
  const paged = yield* decodeBody(collection.source, Paged, reading.body);
  const total = paged.result_info?.total_count;
  if (total !== undefined && total !== paged.result.length) {
    return yield* Effect.fail(unreadable(collection.source, "truncated"));
  }
  return yield* decodeBody(collection.source, shape, reading.body);
});

export { decodeBody, endpoint, readList, readResource, unreadable };
export type { AccountAccess };
