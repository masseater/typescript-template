import type { PhotoSlot } from "@repo/config";

const memberPhotoPath = "/api/member/photo";

function memberPhotoUrl(
  memberId: string,
  slot: PhotoSlot,
  version: string | null,
): string | undefined {
  if (version === null) {
    return undefined;
  }
  const query = new URLSearchParams({ id: memberId, slot, version });
  return `${memberPhotoPath}?${query.toString()}`;
}

export { memberPhotoUrl };
