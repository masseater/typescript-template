import {
  ACCOUNT_STATE,
  PHOTO_SLOT,
  PROFILE_VISIBILITY,
  ROLE,
  type PhotoSlot,
  type ProfileVisibility,
} from "@repo/config";
import { and, eq, not, or, type SQL } from "drizzle-orm";
import { DateTime, Effect } from "effect";

import { query } from "./database.ts";
import { user } from "./identity-schema.ts";
import { blockHides } from "./trust.ts";
import { UserNotFound } from "./user-not-found.ts";

const openProfile: SQL | undefined = and(
  eq(user.visibility, PROFILE_VISIBILITY.allMembers),
  eq(user.emailVerified, true),
  eq(user.role, ROLE.member),
  eq(user.accountState, ACCOUNT_STATE.active),
);

const profileVisibleTo = (viewerId: string): SQL | undefined =>
  and(or(eq(user.id, viewerId), openProfile), not(blockHides(viewerId)));

const profileListed: SQL | undefined = and(openProfile, eq(user.searchable, true));

const canViewProfile = Effect.fn("canViewProfile")(function* canViewProfile(
  viewerId: string,
  targetId: string,
) {
  const [visibleProfile] = yield* query((database) =>
    database
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, targetId), profileVisibleTo(viewerId)))
      .limit(1),
  );
  return visibleProfile !== undefined;
});

type VisibilitySettings = {
  readonly searchable: boolean;
  readonly visibility: ProfileVisibility;
};

const visibilityColumns = { searchable: user.searchable, visibility: user.visibility };

const readVisibility = Effect.fn("readVisibility")(function* readVisibility(userId: string) {
  const [storedVisibility] = yield* query((database) =>
    database.select(visibilityColumns).from(user).where(eq(user.id, userId)).limit(1),
  );
  if (!storedVisibility) {
    return yield* UserNotFound.make();
  }
  return storedVisibility satisfies VisibilitySettings;
});

const updateVisibility = Effect.fn("updateVisibility")(function* updateVisibility(
  userId: string,
  settings: VisibilitySettings,
) {
  const updatedAt = DateTime.toDate(yield* DateTime.now);
  const [savedVisibility] = yield* query((database) =>
    database
      .update(user)
      .set({ ...settings, updatedAt })
      .where(eq(user.id, userId))
      .returning(visibilityColumns),
  );
  if (!savedVisibility) {
    return yield* UserNotFound.make();
  }
  return savedVisibility satisfies VisibilitySettings;
});

const photoKeyColumns = {
  [PHOTO_SLOT.face]: user.facePhotoKey,
  [PHOTO_SLOT.company]: user.companyPhotoKey,
} as const satisfies Record<PhotoSlot, unknown>;

type PhotoKeys = Readonly<Record<PhotoSlot, string | null>>;

const photoKeysOf = Effect.fn("photoKeysOf")(function* photoKeysOf(memberId: string) {
  const [storedPhotoKeys] = yield* query((database) =>
    database.select(photoKeyColumns).from(user).where(eq(user.id, memberId)).limit(1),
  );
  if (!storedPhotoKeys) {
    return yield* UserNotFound.make();
  }
  return storedPhotoKeys satisfies PhotoKeys;
});

const visiblePhotoKey = Effect.fn("visiblePhotoKey")(function* visiblePhotoKey(lookup: {
  readonly viewerId: string;
  readonly memberId: string;
  readonly slot: PhotoSlot;
}) {
  const [visiblePhoto] = yield* query((database) =>
    database
      .select({ key: photoKeyColumns[lookup.slot] })
      .from(user)
      .where(and(eq(user.id, lookup.memberId), profileVisibleTo(lookup.viewerId)))
      .limit(1),
  );
  return visiblePhoto?.key ?? undefined;
});

const setPhotoKey = Effect.fn("setPhotoKey")(function* setPhotoKey(assignment: {
  readonly memberId: string;
  readonly slot: PhotoSlot;
  readonly photoKey: string | null;
}) {
  const replacedPhotoKeys = yield* photoKeysOf(assignment.memberId);
  yield* query((database) =>
    database
      .update(user)
      .set(
        assignment.slot === PHOTO_SLOT.face
          ? { facePhotoKey: assignment.photoKey }
          : { companyPhotoKey: assignment.photoKey },
      )
      .where(eq(user.id, assignment.memberId)),
  );
  return replacedPhotoKeys[assignment.slot];
});

export {
  canViewProfile,
  photoKeysOf,
  profileListed,
  profileVisibleTo,
  readVisibility,
  setPhotoKey,
  updateVisibility,
  visiblePhotoKey,
};
export type { PhotoKeys, VisibilitySettings };
