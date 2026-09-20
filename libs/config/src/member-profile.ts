/** @canonical-values config.profile-visibility */
export const profileVisibilities = ["members", "self"] as const;
export type ProfileVisibility = (typeof profileVisibilities)[number];
export const PROFILE_VISIBILITY = {
  members: profileVisibilities[0],
  self: profileVisibilities[1],
} as const satisfies Record<string, ProfileVisibility>;

/** @canonical-values config.photo-slot */
export const photoSlots = ["face", "company"] as const;
export type PhotoSlot = (typeof photoSlots)[number];
export const PHOTO_SLOT = {
  face: photoSlots[0],
  company: photoSlots[1],
} as const satisfies Record<string, PhotoSlot>;

const MEBIBYTE = 1024 * 1024;
const MAXIMUM_PHOTO_MEBIBYTES = 5;
export const maximumPhotoBytes = MAXIMUM_PHOTO_MEBIBYTES * MEBIBYTE;

/** @canonical-values config.photo-content-type */
export const photoContentTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoContentType = (typeof photoContentTypes)[number];
export const PHOTO_CONTENT_TYPE = {
  jpeg: photoContentTypes[0],
  png: photoContentTypes[1],
  webp: photoContentTypes[2],
} as const satisfies Record<string, PhotoContentType>;
