import { integer, maxValue, minValue, number, object, pipe } from "valibot";
import { httpStatus } from "./http-status.ts";

interface JsonRequest {
  readonly body: Readonly<AsyncIterable<Uint8Array>> | null;
  readonly headers: Readonly<Pick<Headers, "get">>;
}

const defaultBodyLimit = 16_384;
const lastClientError = 499;

const clientErrorSchema = object({
  statusCode: pipe(number(), integer(), minValue(httpStatus.badRequest), maxValue(lastClientError)),
});

function failure(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

function assertJsonRequest(request: JsonRequest, expectedOrigin: string, limit: number): void {
  if (
    request.headers.get("origin") !== expectedOrigin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    throw failure("ORIGIN_DENIED", httpStatus.forbidden);
  }
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    throw failure("JSON_REQUIRED", httpStatus.unsupportedMediaType);
  }
  if (Number(request.headers.get("content-length")) > limit) {
    throw failure("BODY_TOO_LARGE", httpStatus.payloadTooLarge);
  }
}

async function readBoundedText(
  body: Readonly<AsyncIterable<Uint8Array>>,
  limit: number,
): Promise<string> {
  const decoder = new TextDecoder();
  let length = 0;
  let text = "";
  for await (const chunk of body) {
    length += chunk.byteLength;
    if (length > limit) {
      throw failure("BODY_TOO_LARGE", httpStatus.payloadTooLarge);
    }
    text += decoder.decode(chunk, { stream: true });
  }
  return text + decoder.decode();
}

async function readJson(
  request: JsonRequest,
  expectedOrigin: string,
  limit = defaultBodyLimit,
): Promise<unknown> {
  assertJsonRequest(request, expectedOrigin, limit);
  if (!request.body) {
    throw failure("BODY_REQUIRED", httpStatus.badRequest);
  }
  const text = await readBoundedText(request.body, limit);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw failure("INVALID_JSON", httpStatus.badRequest);
  }
}

export { clientErrorSchema, readJson };
export type { JsonRequest };
