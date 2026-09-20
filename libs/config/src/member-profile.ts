import { Schema } from "effect";

/** @canonical-values config.profile-visibility */
export const profileVisibilities = ["all_members", "self"] as const;
export type ProfileVisibility = (typeof profileVisibilities)[number];
export const PROFILE_VISIBILITY = {
  allMembers: profileVisibilities[0],
  self: profileVisibilities[1],
} as const satisfies Record<string, ProfileVisibility>;
