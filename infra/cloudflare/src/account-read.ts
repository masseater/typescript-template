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

const FIRST_PAGE = 1;

const readPage = Effect.fn("readPage")(function* readPage<Shape, Encoded>(
  access: AccountAccess,
  collection: Readonly<{ page: number; pageSize: number; path: string; query?: Query }>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  shape: Schema.Codec<Shape, Encoded>,
) {
  const reading = yield* fetchJson(access.apiToken, collection.path, {
    ...collection.query,
    page: String(collection.page),
    per_page: String(collection.pageSize),
  });
  if (!reading.found) {
    return yield* Effect.fail(unreadable());
  }
  const paged = yield* decodeBody(Paged, reading.body);
  return {
    rows: paged.result.length,
    total: paged.result_info?.total_count,
    value: yield* decodeBody(shape, reading.body),
  } as const;
});

const readPages = Effect.fn("readPages")(function* readPages<Shape, Encoded>(
  access: AccountAccess,
  collection: Readonly<{ pageSize: number; path: string; query?: Query }>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
    return yield* Effect.fail(unreadable());
  }
  return [first.value, ...rest.map((page) => page.value)];
});

export { decodeBody, readList, readPages, readResource, unreadable };
export type { AccountAccess };
