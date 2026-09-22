import {
  ApiKeyWriteForbidden,
  MemberProfileNotFound,
  SessionIdentity,
  type MemberProfileUpdate,
  type MemberProfileView,
} from "@repo/core-api";
import { eq, query, schema, type Database, type DatabaseFailure } from "@repo/db";
import { DateTime, Effect } from "effect";

import { photoVersion } from "./member-directory.ts";

const { user } = schema;

const profileColumns = {
  companyPhotoKey: user.companyPhotoKey,
  email: user.email,
  facePhotoKey: user.facePhotoKey,
  id: user.id,
  name: user.name,
  profile: user.profile,
  socialLinks: user.socialLinks,
};

const ownProfile = ({
  companyPhotoKey,
  facePhotoKey,
  ...profile
}: {
  readonly companyPhotoKey: string | null;
  readonly email: string;
  readonly facePhotoKey: string | null;
  readonly id: string;
  readonly name: string;
  readonly profile: string;
  readonly socialLinks: readonly string[];
}): typeof MemberProfileView.Type => ({
  ...profile,
  photos: {
    company: photoVersion(companyPhotoKey),
    face: photoVersion(facePhotoKey),
  },
});

const readMemberProfile = (): Effect.Effect<
  typeof MemberProfileView.Type,
  MemberProfileNotFound,
  SessionIdentity | Database
> =>
  Effect.gen(function* readMemberProfileProgram() {
    const identity = yield* SessionIdentity;
    const [profile] = yield* query((database) =>
      database.select(profileColumns).from(user).where(eq(user.id, identity.user.id)).limit(1),
    );
    if (profile === undefined) {
      return yield* new MemberProfileNotFound();
    }
    return ownProfile(profile);
  }).pipe(Effect.catchTag("DatabaseFailure", (failure: DatabaseFailure) => Effect.die(failure)));

const apiKeySessionPrefix = "api-key:";

const writeMemberProfile = (
  values: typeof MemberProfileUpdate.Type,
): Effect.Effect<
  typeof MemberProfileView.Type,
  ApiKeyWriteForbidden | MemberProfileNotFound,
  SessionIdentity | Database
> =>
  Effect.gen(function* writeMemberProfileProgram() {
    const identity = yield* SessionIdentity;
    if (identity.session.id.startsWith(apiKeySessionPrefix)) {
      return yield* new ApiKeyWriteForbidden();
    }
    const updatedAt = DateTime.toDate(yield* DateTime.now);
    const [profile] = yield* query((database) =>
      database
        .update(user)
        .set({ ...values, updatedAt })
        .where(eq(user.id, identity.user.id))
        .returning(profileColumns),
    );
    if (profile === undefined) {
      return yield* new MemberProfileNotFound();
    }
    return ownProfile(profile);
  }).pipe(Effect.catchTag("DatabaseFailure", (failure: DatabaseFailure) => Effect.die(failure)));

export { readMemberProfile, writeMemberProfile };
