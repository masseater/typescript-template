import type { PhotoSlot } from "@repo/config";

const keyPrefix = "photos";
const separator = "/";

function photoKey(memberId: string, slot: PhotoSlot, version: string): string {
  return [keyPrefix, memberId, slot, version].join(separator);
}

function photoVersion(key: string | null): string | null {
  return key === null ? key : key.slice(key.lastIndexOf(separator) + 1);
}

export { photoKey, photoVersion };
