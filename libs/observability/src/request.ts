import { Effect, Schema } from "effect";

export class RequestRejected extends Schema.TaggedError<RequestRejected>()("RequestRejected", {
  reason: Schema.Literals([
    "origin_denied",
    "json_required",
    "body_required",
    "body_too_large",
    "invalid_json",
  ]),
}) {}

export const rejectionStatus: Record<RequestRejected["reason"], number> = {
  origin_denied: 403,
  json_required: 415,
  body_required: 400,
  body_too_large: 413,
  invalid_json: 400,
};

const reject = (reason: RequestRejected["reason"]) => new RequestRejected({ reason });

const readText = (body: ReadableStream<Uint8Array>, limit: number) =>
  Effect.promise(async () => {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let length = 0;
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      length += chunk.value.byteLength;
      if (length > limit) {
        await reader.cancel();
        return undefined;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  });

export const readJson = Effect.fn("readJson")(function* (
  request: Request,
  expectedOrigin: string,
  limit: number = 16_384,
) {
  if (
    request.headers.get("origin") !== expectedOrigin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return yield* reject("origin_denied");
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    return yield* reject("json_required");
  if (Number(request.headers.get("content-length")) > limit) return yield* reject("body_too_large");
  if (request.body === null) return yield* reject("body_required");
  const text = yield* readText(request.body, limit);
  if (text === undefined) return yield* reject("body_too_large");
  return yield* Effect.try({
    try: (): unknown => JSON.parse(text),
    catch: () => reject("invalid_json"),
  });
});
