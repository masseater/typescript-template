import { Effect, Predicate, Schema } from "effect";

import { CloudflareFailure } from "./config.ts";

const REQUEST_TIMEOUT_MS = 30_000;
const NOT_FOUND_STATUS = 404;
const MISSING_REASON = `status_${NOT_FOUND_STATUS}`;

interface AccountAccess {
  readonly accountId: string;
  readonly apiToken: string;
}

const cloudflareEndpoint = Symbol("cloudflareEndpoint");

type Query = Readonly<Record<string, string>>;
type Endpoint = Readonly<{ marker: typeof cloudflareEndpoint; path: string; shape: string }>;
type Collection = Readonly<{ filter?: Query; pageSize?: number; source: Endpoint }>;

const PageInfo = Schema.Struct({
  per_page: Schema.optional(Schema.Number),
  total_count: Schema.optional(Schema.Number),
});
const Paged = Schema.Struct({
  result: Schema.Array(Schema.Unknown),
  result_info: Schema.optional(Schema.NullOr(PageInfo)),
});

function endpoint(parts: TemplateStringsArray, ...values: readonly string[]): Endpoint {
  return {
    marker: cloudflareEndpoint,
    path: String.raw(parts, ...values),
    shape: parts.join("{}"),
  };
}

function unreadable(source: Endpoint, reason: string): CloudflareFailure {
  return new CloudflareFailure({ code: "account_read_unavailable", keys: [source.shape, reason] });
}

function requestReason(error: unknown): string {
  return Predicate.hasProperty(error, "name") && error.name === "TimeoutError"
    ? "timeout"
    : "request_failed";
}

function listedQuery(collection: Collection): Query {
  return collection.pageSize === undefined
    ? { ...collection.filter }
    : { ...collection.filter, per_page: String(collection.pageSize) };
}

function overflowed(
  rows: number,
  info:
    | Readonly<{ per_page?: number | undefined; total_count?: number | undefined }>
    | null
    | undefined,
  collection: Collection,
): boolean {
  const counted = info?.total_count;
  if (counted !== undefined && (counted <= rows || collection.filter === undefined)) {
    return counted > rows;
  }
  const page = info?.per_page ?? collection.pageSize;
  return page !== undefined && page > 0 && rows >= page;
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
  shape: Schema.Codec<Shape, Encoded>,
) {
  const reading = yield* fetchJson(access.apiToken, source, {});
  return reading.found ? yield* decodeBody(source, shape, reading.body) : undefined;
});

const readRequired = Effect.fn("readRequired")(function* readRequired<Shape, Encoded>(
  access: AccountAccess,
  source: Endpoint,
  shape: Schema.Codec<Shape, Encoded>,
) {
  const found = yield* readResource(access, source, shape);
  if (found === undefined) {
    return yield* Effect.fail(unreadable(source, MISSING_REASON));
  }
  return found;
});

const readList = Effect.fn("readList")(function* readList<Shape, Encoded>(
  access: AccountAccess,
  collection: Collection,
  shape: Schema.Codec<Shape, Encoded>,
) {
  const reading = yield* fetchJson(access.apiToken, collection.source, listedQuery(collection));
  if (!reading.found) {
    return yield* Effect.fail(unreadable(collection.source, MISSING_REASON));
  }
  const paged = yield* decodeBody(collection.source, Paged, reading.body);
  if (overflowed(paged.result.length, paged.result_info, collection)) {
    return yield* Effect.fail(unreadable(collection.source, "truncated"));
  }
  return yield* decodeBody(collection.source, shape, reading.body);
});

const FIRST_PAGE = 1;

type Pages = Readonly<{ filter?: Query; pageSize: number; source: Endpoint }>;

const readPage = Effect.fn("readPage")(function* readPage<Shape, Encoded>(
  access: AccountAccess,
  asked: Pages & Readonly<{ page: number }>,
  shape: Schema.Codec<Shape, Encoded>,
) {
  const reading = yield* fetchJson(access.apiToken, asked.source, {
    ...listedQuery(asked),
    page: String(asked.page),
  });
  if (!reading.found) {
    return yield* Effect.fail(unreadable(asked.source, MISSING_REASON));
  }
  const paged = yield* decodeBody(asked.source, Paged, reading.body);
  return {
    rows: paged.result.length,
    total: paged.result_info?.total_count,
    value: yield* decodeBody(asked.source, shape, reading.body),
  } as const;
});

const readPages = Effect.fn("readPages")(function* readPages<Shape, Encoded>(
  access: AccountAccess,
  collection: Pages,
  shape: Schema.Codec<Shape, Encoded>,
) {
  const first = yield* readPage(access, { ...collection, page: FIRST_PAGE }, shape);
  if (first.total === undefined || first.total <= first.rows) {
    return [first.value];
  }
  const rest = yield* Effect.forEach(
    Array.from(
      { length: Math.ceil(first.total / collection.pageSize) - FIRST_PAGE },
      (_unused, index) => index + FIRST_PAGE + 1,
    ),
    (page) => readPage(access, { ...collection, page }, shape),
  );
  const gathered = rest.reduce((rows, page) => rows + page.rows, first.rows);
  if (gathered !== first.total) {
    return yield* Effect.fail(unreadable(collection.source, "truncated"));
  }
  return [first.value, ...rest.map((page) => page.value)];
});

export { decodeBody, endpoint, readList, readPages, readRequired, readResource, requestReason };
export type { AccountAccess, Endpoint };
