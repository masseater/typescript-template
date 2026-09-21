import { ACCOUNT_STATE, PHOTO_SLOT, PROFILE_VISIBILITY, ROLE } from "@repo/config";
import { and, eq, not, or } from "drizzle-orm";
import { Effect } from "effect";

import { query } from "./database.ts";
import { user } from "./identity-schema.ts";
import { blockHides } from "./trust.ts";
import { UserNotFound } from "./user-not-found.ts";

import type { PhotoSlot, ProfileVisibility } from "@repo/config";
import type { SQL } from "drizzle-orm";

const openProfile: SQL | undefined = and(
  eq(user.visibility, PROFILE_VISIBILITY.allMembers),
  eq(user.emailVerified, true),
  eq(user.role, ROLE.member),
  eq(user.accountState, ACCOUNT_STATE.active),
);

function profileVisibleTo(viewerId: string): SQL | undefined {
  return and(or(eq(user.id, viewerId), openProfile), not(blockHides(viewerId)));
}

const profileListed: SQL | undefined = and(openProfile, eq(user.searchable, true));

const canViewProfile = Effect.fn("canViewProfile")(function* canViewProfile(
  viewerId: string,
  targetId: string,
) {
  const [row] = yield* query((database) =>
    database
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, targetId), profileVisibleTo(viewerId)))
      .limit(1),
  );
  return row !== undefined;
});

interface VisibilitySettings {
  readonly searchable: boolean;
  readonly visibility: ProfileVisibility;
}

const visibilityColumns = { searchable: user.searchable, visibility: user.visibility };

const readVisibility = Effect.fn("readVisibility")(function* readVisibility(userId: string) {
  const [row] = yield* query((database) =>
    database.select(visibilityColumns).from(user).where(eq(user.id, userId)).limit(1),
  );
  if (!row) {
    return yield* new UserNotFound();
  }
  return row satisfies VisibilitySettings;
});

const updateVisibility = Effect.fn("updateVisibility")(function* updateVisibility(
  userId: string,
  values: VisibilitySettings,
) {
  const [row] = yield* query((database) =>
    database
      .update(user)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(user.id, userId))
      .returning(visibilityColumns),
  );
  if (!row) {
    return yield* new UserNotFound();
  }
  return row satisfies VisibilitySettings;
});

const photoKeyColumns = {
  [PHOTO_SLOT.face]: user.facePhotoKey,
  [PHOTO_SLOT.company]: user.companyPhotoKey,
} as const satisfies Record<PhotoSlot, unknown>;

type PhotoKeys = Readonly<Record<PhotoSlot, string | null>>;

const photoKeysOf = Effect.fn("photoKeysOf")(function* photoKeysOf(memberId: string) {
  const [row] = yield* query((database) =>
    database.select(photoKeyColumns).from(user).where(eq(user.id, memberId)).limit(1),
  );
  if (!row) {
    return yield* new UserNotFound();
  }
  return row satisfies PhotoKeys;
});

const visiblePhotoKey = Effect.fn("visiblePhotoKey")(function* visiblePhotoKey(
  viewerId: string,
  memberId: string,
  slot: PhotoSlot,
) {
  const [row] = yield* query((database) =>
    database
      .select({ key: photoKeyColumns[slot] })
      .from(user)
      .where(and(eq(user.id, memberId), profileVisibleTo(viewerId)))
      .limit(1),
  );
  return row?.key ?? undefined;
});

const setPhotoKey = Effect.fn("setPhotoKey")(function* setPhotoKey(
  memberId: string,
  slot: PhotoSlot,
  key: string | null,
) {
  const previous = yield* photoKeysOf(memberId);
  yield* query((database) =>
    database
      .update(user)
      .set(slot === PHOTO_SLOT.face ? { facePhotoKey: key } : { companyPhotoKey: key })
      .where(eq(user.id, memberId)),
  );
  return previous[slot];
});

const clearPhotoKeys = Effect.fn("clearPhotoKeys")(function* clearPhotoKeys(memberId: string) {
  const previous = yield* photoKeysOf(memberId);
  yield* query((database) =>
    database
      .update(user)
      // oxlint-disable-next-line unicorn/no-null
      .set({ companyPhotoKey: null, facePhotoKey: null })
      .where(eq(user.id, memberId)),
  );
  return previous;
});

export {
  canViewProfile,
  clearPhotoKeys,
  photoKeysOf,
  profileListed,
  profileVisibleTo,
  readVisibility,
  setPhotoKey,
  updateVisibility,
  visiblePhotoKey,
};
export type { PhotoKeys, VisibilitySettings };
