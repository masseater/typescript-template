import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { PhotoView } from "#shared/contracts/index.ts";

import type { PhotoSlot } from "@repo/config";

type PhotoState = typeof PhotoView.Type;

async function uploadPhoto(slot: PhotoSlot, file: File): Promise<PhotoState> {
  const { api } = await userClient();
  return apiData(PhotoView, await api.profile.photo.put({ file }, { query: { slot } }));
}

async function removePhoto(slot: PhotoSlot): Promise<PhotoState> {
  const { api } = await userClient();
  return apiData(PhotoView, await api.profile.photo.delete(undefined, { query: { slot } }));
}

export { removePhoto, uploadPhoto };
export type { PhotoState };
