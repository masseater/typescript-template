import * as v from "valibot";

export const clientErrorSchema = v.object({
  statusCode: v.pipe(v.number(), v.integer(), v.minValue(400), v.maxValue(499)),
});

const failure = (message: string, statusCode: number) =>
  Object.assign(new Error(message), { statusCode });

export async function readJson(
  request: Request,
  expectedOrigin: string,
  limit = 16_384,
): Promise<unknown> {
  if (
    request.headers.get("origin") !== expectedOrigin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw failure("ORIGIN_DENIED", 403);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw failure("JSON_REQUIRED", 415);
  if (Number(request.headers.get("content-length")) > limit) throw failure("BODY_TOO_LARGE", 413);
  const reader = request.body?.getReader();
  if (!reader) throw failure("BODY_REQUIRED", 400);
  const decoder = new TextDecoder();
  let text = "";
  let length = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    length += chunk.value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw failure("BODY_TOO_LARGE", 413);
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  try {
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch {
    throw failure("INVALID_JSON", 400);
  }
}
