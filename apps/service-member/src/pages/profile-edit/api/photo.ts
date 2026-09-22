import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { PhotoView } from "#shared/contracts/index.ts";

import type { PhotoSlot } from "@repo/config";
import type { ApiReply } from "@repo/runtime/client";

type PhotoState = typeof PhotoView.Type;

function uploadPhoto(slot: PhotoSlot, file: File): Promise<PhotoState> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.profile.photo
      .put({ file }, { query: { slot } })
      .then((response: ApiReply) => apiData(PhotoView, response)),
  );
}

function removePhoto(slot: PhotoSlot): Promise<PhotoState> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.profile.photo
      .delete(undefined, { query: { slot } })
      .then((response: ApiReply) => apiData(PhotoView, response)),
  );
}

export { removePhoto, uploadPhoto };
