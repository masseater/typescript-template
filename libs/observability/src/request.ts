import { Effect, Option, Schema } from "effect";
import { httpStatus } from "./http-status.ts";

interface JsonRequest {
  readonly body: Readonly<AsyncIterable<Uint8Array>> | null;
  readonly headers: Readonly<Pick<Headers, "get">>;
}

const defaultBodyLimit = 16_384;

class RequestRejected extends Schema.TaggedError<RequestRejected>()("RequestRejected", {
  reason: Schema.Literals([
    "origin_denied",
    "json_required",
    "body_required",
    "body_too_large",
    "invalid_json",
  ]),
}) {}

const rejectionStatus: Readonly<Record<RequestRejected["reason"], number>> = {
  body_required: httpStatus.badRequest,
  body_too_large: httpStatus.payloadTooLarge,
  invalid_json: httpStatus.badRequest,
  json_required: httpStatus.unsupportedMediaType,
  origin_denied: httpStatus.forbidden,
};

function headerRejection(
  request: JsonRequest,
  expectedOrigin: string,
  limit: number,
): Option.Option<RequestRejected["reason"]> {
  if (
    request.headers.get("origin") !== expectedOrigin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return Option.some("origin_denied");
  }
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return Option.some("json_required");
  }
  return Number(request.headers.get("content-length")) > limit
    ? Option.some("body_too_large")
    : Option.none();
}

async function readBoundedText(
  body: Readonly<AsyncIterable<Uint8Array>>,
  limit: number,
): Promise<string | undefined> {
  const decoder = new TextDecoder();
  let length = 0;
  let text = "";
  for await (const chunk of body) {
    length += chunk.byteLength;
    if (length > limit) {
      return undefined;
    }
    text += decoder.decode(chunk, { stream: true });
  }
  return text + decoder.decode();
}

const parseJson = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown));

const readBody = Effect.fn("readBody")(function* readBody(
  body: Readonly<AsyncIterable<Uint8Array>>,
  limit: number,
) {
  const text = yield* Effect.promise(async () => readBoundedText(body, limit));
  if (text === undefined) {
    return yield* new RequestRejected({ reason: "body_too_large" });
  }
  return yield* parseJson(text).pipe(
    Effect.mapError(() => new RequestRejected({ reason: "invalid_json" })),
  );
});

function readJson(
  request: JsonRequest,
  expectedOrigin: string,
  limit = defaultBodyLimit,
): Effect.Effect<unknown, RequestRejected> {
  const rejection = headerRejection(request, expectedOrigin, limit);
  if (Option.isSome(rejection)) {
    return Effect.fail(new RequestRejected({ reason: rejection.value }));
  }
  return request.body === null
    ? Effect.fail(new RequestRejected({ reason: "body_required" }))
    : readBody(request.body, limit);
}

export { RequestRejected, readJson, rejectionStatus };
export type { JsonRequest };
