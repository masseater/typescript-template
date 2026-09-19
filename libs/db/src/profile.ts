import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { query } from "./database.ts";
import { user } from "./schema.ts";
import { UserNotFound } from "./user-not-found.ts";

const profileColumns = {
  email: user.email,
  id: user.id,
  name: user.name,
  profile: user.profile,
};

export const checkDatabase = Effect.fn("checkDatabase")(function* checkDatabase() {
  yield* query((database) => database.select({ id: user.id }).from(user).limit(1));
});

export const getProfile = Effect.fn("getProfile")(function* getProfile(userId: string) {
  const [profile] = yield* query((database) =>
    database.select(profileColumns).from(user).where(eq(user.id, userId)).limit(1),
  );

  return profile ?? null;
});

export const updateProfile = Effect.fn("updateProfile")(function* updateProfile(
  userId: string,
  edited: { readonly name: string; readonly profile: string },
) {
  const [profile] = yield* query((database) =>
    database
      .update(user)
      .set({ ...edited, updatedAt: new Date() })
      .where(eq(user.id, userId))
      .returning(profileColumns),
  );
  if (!profile) {
    return yield* new UserNotFound();
  }
  return profile;
});
