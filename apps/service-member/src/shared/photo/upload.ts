import { isPhotoContentType, maximumPhotoBytes } from "@repo/config";
import { RequestRejected } from "@repo/observability";
import { AppOrigin } from "@repo/runtime/http";
import { Effect, Stream } from "effect";

import { PhotoMissing } from "./photo-missing.ts";
import { PhotoTooLarge } from "./photo-too-large.ts";
import { PhotoUnsupported } from "./photo-unsupported.ts";

type Bytes = Uint8Array<ArrayBuffer>;

const multipartType = "multipart/form-data";
const multipartOverheadBytes = 16_384;
const fileField = "file";

interface Collected {
  readonly byteLength: number;
  readonly chunks: readonly Uint8Array[];
}

function mediaType(request: Request): string {
  return request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
}

function crossOrigin(request: Request, expectedOrigin: string): boolean {
  return (
    request.headers.get("origin") !== expectedOrigin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  );
}

function tooLarge(request: Request, limit: number): boolean {
  return Number(request.headers.get("content-length")) > limit;
}

function readBounded(
  body: ReadableStream<Uint8Array>,
  limit: number,
): Effect.Effect<Bytes, PhotoMissing | PhotoTooLarge> {
  return Stream.fromReadableStream({
    evaluate: () => body,
    onError: () => PhotoMissing.make(),
  }).pipe(
    Stream.runFoldEffect(
      (): Collected => ({ byteLength: 0, chunks: [] }),
      (collected, chunk) => {
        const byteLength = collected.byteLength + chunk.byteLength;
        return byteLength > limit
          ? Effect.fail(PhotoTooLarge.make())
          : Effect.succeed({ byteLength, chunks: [...collected.chunks, chunk] });
      },
    ),
    Effect.map(({ byteLength, chunks }): Bytes => {
      const joined = new Uint8Array(byteLength);
      let position = 0;
      for (const chunk of chunks) {
        joined.set(chunk, position);
        position += chunk.byteLength;
      }
      return joined;
    }),
  );
}

function fileOf(bytes: Bytes, contentType: string): Effect.Effect<Bytes, PhotoMissing> {
  return Effect.tryPromise({
    catch: () => PhotoMissing.make(),
    try: (): Promise<Bytes | undefined> =>
      new Response(bytes, {
        headers: { "content-type": contentType },
      })
        .formData()
        .then((form) => {
          const file = form.get(fileField);
          return file instanceof Blob
            ? file.arrayBuffer().then((buffer) => new Uint8Array(buffer))
            : undefined;
        }),
  }).pipe(
    Effect.filterOrFail(
      (file): file is Bytes => file !== undefined,
      () => PhotoMissing.make(),
    ),
  );
}

const readPhotoUpload = Effect.fn("readPhotoUpload")(function* readPhotoUpload(request: Request) {
  if (crossOrigin(request, yield* AppOrigin)) {
    return yield* RequestRejected.make({ reason: "origin_denied" });
  }
  const type = mediaType(request);
  const multipart = type === multipartType;
  if (!multipart && !isPhotoContentType(type)) {
    return yield* PhotoUnsupported.make();
  }
  const limit = multipart ? maximumPhotoBytes + multipartOverheadBytes : maximumPhotoBytes;
  if (tooLarge(request, limit)) {
    return yield* PhotoTooLarge.make();
  }
  if (request.body === null) {
    return yield* PhotoMissing.make();
  }
  const body = yield* readBounded(request.body, limit);
  const file = multipart
    ? yield* fileOf(body, request.headers.get("content-type") ?? multipartType)
    : body;
  if (file.byteLength > maximumPhotoBytes) {
    return yield* PhotoTooLarge.make();
  }
  if (file.byteLength === 0) {
    return yield* PhotoMissing.make();
  }
  return file;
});

export { readPhotoUpload };
