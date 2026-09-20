import { verifySession } from "@repo/auth";
import { maximumPhotoMebibytes } from "@repo/config";
import { httpStatus } from "@repo/observability";
import { unavailable } from "@repo/runtime/account";
import { createApi, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import { MemberPhotoQuery, PhotoQuery, PhotoView } from "#shared/contracts/index.ts";
import { readPhoto, readPhotoUpload, removePhoto, uploadPhoto } from "#shared/photo/index.ts";

import type { PhotoStore } from "#shared/photo/index.ts";
import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = {
  ...unavailable,
  PhotoMissing: { message: "画像ファイルを選んでください。", status: httpStatus.badRequest },
  PhotoNotFound: { message: "写真が見つかりません。", status: httpStatus.notFound },
  PhotoStorageFailed: "unexpected",
  PhotoTooLarge: {
    message: `画像は ${maximumPhotoMebibytes} MB 以下にしてください。`,
    status: httpStatus.payloadTooLarge,
  },
  PhotoUnsupported: {
    message: "JPEG、PNG、WebP の画像だけを登録できます。",
    status: httpStatus.unsupportedMediaType,
  },
  UserNotFound: { message: "対象が見つかりません。", status: httpStatus.notFound },
} as const;

const photoHeaders = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };

function photoApi(api: ApiRoutes<AppServices | PhotoStore>) {
  return createApi("")
    .get(
      "/member/photo",
      api.raw(
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { id, slot } = yield* readSearchParams(MemberPhotoQuery, request);
            const photo = yield* readPhoto(user.id, id, slot);
            return new Response(photo.bytes, {
              headers: { ...photoHeaders, "content-type": photo.contentType },
            });
          }),
        failures,
      ),
    )
    .put(
      "/profile/photo",
      api.route(
        PhotoView,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { slot } = yield* readSearchParams(PhotoQuery, request);
            const file = yield* readPhotoUpload(request);
            return yield* uploadPhoto(user.id, slot, file);
          }),
        failures,
      ),
    )
    .delete(
      "/profile/photo",
      api.route(
        PhotoView,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { slot } = yield* readSearchParams(PhotoQuery, request);
            return yield* removePhoto(user.id, slot);
          }),
        failures,
      ),
    );
}

export { photoApi };
