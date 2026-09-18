import { Effect, Option, Schema, Stream } from "effect";

import { httpStatus } from "./http-status.ts";

export type JsonRequest = {
  readonly body: Readonly<AsyncIterable<Uint8Array>> | null;
  readonly headers: Readonly<Pick<Headers, "get">>;
};

const defaultBodyLimit = 16_384;

export class RequestRejected extends Schema.TaggedError<RequestRejected>()("RequestRejected", {
  reason: Schema.Literals([
    "origin_denied",
    "json_required",
    "body_required",
    "body_too_large",
    "invalid_json",
  ]),
}) {}

export const rejectionStatus = {
  body_required: httpStatus.badRequest,
  body_too_large: httpStatus.payloadTooLarge,
  invalid_json: httpStatus.badRequest,
  json_required: httpStatus.unsupportedMediaType,
  origin_denied: httpStatus.forbidden,
} as const satisfies Readonly<Record<RequestRejected["reason"], number>>;

const headerRejection = (received: {
  readonly incoming: JsonRequest;
  readonly expectedOrigin: string;
  readonly limit: number;
}): Option.Option<RequestRejected["reason"]> => {
  const { headers } = received.incoming;
  if (
    headers.get("origin") !== received.expectedOrigin ||
    headers.get("sec-fetch-site") === "cross-site"
  ) {
    return Option.some("origin_denied");
  }
  if (headers.get("content-type")?.split(";")[0] !== "application/json") {
    return Option.some("json_required");
  }
  return Number(headers.get("content-length")) > received.limit
    ? Option.some("body_too_large")
    : Option.none();
};

const parseJson = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown));

const readBody = (bounded: {
  readonly body: Readonly<AsyncIterable<Uint8Array>>;
  readonly limit: number;
}): Effect.Effect<unknown, RequestRejected> =>
  Stream.fromAsyncIterable(
    bounded.body,
    () => new RequestRejected({ reason: "invalid_json" }),
  ).pipe(
    Stream.runFoldEffect(
      (): { readonly byteLength: number; readonly chunks: readonly Uint8Array[] } => ({
        byteLength: 0,
        chunks: [],
      }),
      (collected, bodyChunk) => {
        const byteLength = collected.byteLength + bodyChunk.byteLength;
        return byteLength > bounded.limit
          ? Effect.fail(new RequestRejected({ reason: "body_too_large" }))
          : Effect.succeed({ byteLength, chunks: [...collected.chunks, bodyChunk] });
      },
    ),
    Effect.map(({ chunks }) => {
      const decoder = new TextDecoder();
      return `${chunks.map((bodyChunk) => decoder.decode(bodyChunk, { stream: true })).join("")}${decoder.decode()}`;
    }),
    Effect.flatMap((bodyText) =>
      parseJson(bodyText).pipe(
        Effect.mapError(() => new RequestRejected({ reason: "invalid_json" })),
      ),
    ),
  );

export const readJson = (received: {
  readonly incoming: JsonRequest;
  readonly expectedOrigin: string;
  readonly limit?: number;
}): Effect.Effect<unknown, RequestRejected> => {
  const limit = received.limit ?? defaultBodyLimit;
  const rejection = headerRejection({ ...received, limit });
  if (Option.isSome(rejection)) {
    return Effect.fail(new RequestRejected({ reason: rejection.value }));
  }
  return received.incoming.body === null
    ? Effect.fail(new RequestRejected({ reason: "body_required" }))
    : readBody({ body: received.incoming.body, limit });
};
