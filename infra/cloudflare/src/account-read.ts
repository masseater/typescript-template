import { httpStatus } from "@repo/observability";
import { Duration, Effect, Predicate, Schema, SchemaIssue } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";

import { CloudflareFailure } from "./config.ts";

import type { StandardSchema } from "effect";
import type { HttpClientResponse } from "effect/unstable/http";

const REQUEST_TIMEOUT_MS = 30_000;
const MISSING_REASON = `status_${httpStatus.notFound}`;
const DECODE_REASON = "decode_failed";
const UNDECLARED_MEDIA_TYPE = "media_type_undeclared";
const WHOLE_BODY = "$";

interface AccountAccess {
  readonly accountId: string;
  readonly apiToken: string;
}

type Unreadable = Readonly<{ unreadable: readonly string[] }>;

const cloudflareEndpoint = Symbol("cloudflareEndpoint");

type Query = Readonly<Record<string, string>>;
type Endpoint = Readonly<{ marker: typeof cloudflareEndpoint; path: string; shape: string }>;
type Collection = Readonly<{ filter?: Query; pageSize?: number; source: Endpoint }>;

const PageInfo = Schema.Struct({
  per_page: Schema.optional(Schema.Finite),
  total_count: Schema.optional(Schema.Finite),
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

function unreadable(
  source: Endpoint,
  reason: string,
  detail: readonly string[] = [],
): CloudflareFailure {
  return new CloudflareFailure({
    code: "account_read_unavailable",
    keys: [source.shape, reason, ...detail],
  });
}

function unreadableVerdict(
  failure: Readonly<{ keys: readonly string[] }>,
): Effect.Effect<Unreadable> {
  return Effect.succeed({ unreadable: failure.keys });
}

const STATE_STORE_SOURCE = "state_store";

function stateFailureKeys(failure: unknown): readonly string[] {
  if (typeof failure === "string") {
    return [failure];
  }
  if (
    Predicate.hasProperty(failure, "keys") &&
    Array.isArray(failure.keys) &&
    failure.keys.every((key) => typeof key === "string")
  ) {
    return failure.keys;
  }
  if (Predicate.hasProperty(failure, "_tag") && typeof failure._tag === "string") {
    return Predicate.hasProperty(failure, "reason") && typeof failure.reason === "string"
      ? [failure._tag, failure.reason]
      : [failure._tag];
  }
  return ["unknown_failure"];
}

function unreadableState(failure: unknown): Effect.Effect<Unreadable> {
  return Effect.succeed({ unreadable: [STATE_STORE_SOURCE, ...stateFailureKeys(failure)] });
}

function isUnreadable(verdict: unknown): verdict is Unreadable {
  return Predicate.hasProperty(verdict, "unreadable");
}

function readVerdict<Value, Verdict>(
  read: Unreadable | Value,
  decide: (value: Value) => Verdict,
): Unreadable | Verdict {
  return isUnreadable(read) ? read : decide(read);
}

const issueFormatter = SchemaIssue.makeFormatterStandardSchemaV1({
  leafHook: (issue) => issue._tag,
});

function mismatches(failure: StandardSchema.StandardSchemaV1.FailureResult): readonly string[] {
  return failure.issues.map((issue) => {
    const path = (issue.path ?? [])
      .map((key) => (typeof key === "object" ? String(key.key) : String(key)))
      .join(".");
    return `${path === "" ? WHOLE_BODY : path}:${issue.message}`;
  });
}

function mediaType(response: HttpClientResponse.HttpClientResponse): string {
  const declared = response.headers["content-type"]?.split(";", 1)[0]?.trim();
  return declared === undefined || declared === "" ? UNDECLARED_MEDIA_TYPE : declared;
}

function requestReason(error: unknown): string {
  if (Predicate.hasProperty(error, "_tag") && error._tag === "TimeoutError") {
    return "timeout";
  }
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
  const response = yield* HttpClient.get(url, {
    headers: { authorization: `Bearer ${apiToken}` },
  }).pipe(
    Effect.timeout(Duration.millis(REQUEST_TIMEOUT_MS)),
    Effect.provide(FetchHttpClient.layer),
    Effect.mapError((error) => unreadable(source, requestReason(error))),
  );
  if (response.status === httpStatus.notFound) {
    return { body: undefined, found: false };
  }
  if (response.status < 200 || response.status >= 300) {
    return yield* unreadable(source, `status_${response.status}`);
  }
  const body = yield* response.json.pipe(
    Effect.mapError(() => unreadable(source, DECODE_REASON, [mediaType(response)])),
  );
  return { body, found: true };
});

const decodeBody = Effect.fn("decodeBody")(function* decodeBody<Shape, Encoded>(
  source: Endpoint,
  shape: Schema.Codec<Shape, Encoded>,
  body: unknown,
) {
  return yield* Schema.decodeUnknownEffect(shape)(body).pipe(
    Effect.mapError((error) =>
      unreadable(source, DECODE_REASON, mismatches(issueFormatter(error.issue))),
    ),
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
    return yield* unreadable(source, MISSING_REASON);
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
    return yield* unreadable(collection.source, MISSING_REASON);
  }
  const paged = yield* decodeBody(collection.source, Paged, reading.body);
  if (overflowed(paged.result.length, paged.result_info, collection)) {
    return yield* unreadable(collection.source, "truncated");
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
    return yield* unreadable(asked.source, MISSING_REASON);
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
    return yield* unreadable(collection.source, "truncated");
  }
  return [first.value, ...rest.map((page) => page.value)];
});

export {
  STATE_STORE_SOURCE,
  endpoint,
  isUnreadable,
  readList,
  readPages,
  readRequired,
  readResource,
  readVerdict,
  requestReason,
  unreadableState,
  unreadableVerdict,
};
export type { AccountAccess, Endpoint, Unreadable };
