import {
  MemberProfileNotFound,
  type MemberProfileUpdate,
  type MemberProfileView,
} from "@repo/core-api";
import { eq, query, schema, type Database, type DatabaseFailure } from "@repo/db";
import { DateTime, Effect } from "effect";

const { user } = schema;

const profileColumns = {
  email: user.email,
  id: user.id,
  name: user.name,
  profile: user.profile,
  socialLinks: user.socialLinks,
};

const readMemberProfile = (
  userId: string,
): Effect.Effect<
  typeof MemberProfileView.Type,
  MemberProfileNotFound | DatabaseFailure,
  Database
> =>
  Effect.gen(function* readMemberProfile() {
    const [profile] = yield* query((database) =>
      database.select(profileColumns).from(user).where(eq(user.id, userId)).limit(1),
    );
    if (profile === undefined) {
      return yield* new MemberProfileNotFound();
    }
    return profile;
  });

const writeMemberProfile = (
  userId: string,
  values: typeof MemberProfileUpdate.Type,
): Effect.Effect<
  typeof MemberProfileView.Type,
  MemberProfileNotFound | DatabaseFailure,
  Database
> =>
  Effect.gen(function* writeMemberProfile() {
    const updatedAt = DateTime.toDate(yield* DateTime.now);
    const [profile] = yield* query((database) =>
      database
        .update(user)
        .set({ ...values, updatedAt })
        .where(eq(user.id, userId))
        .returning(profileColumns),
    );
    if (profile === undefined) {
      return yield* new MemberProfileNotFound();
    }
    return profile;
  });

export { readMemberProfile, writeMemberProfile };
