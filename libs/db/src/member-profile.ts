import { PROFILE_VISIBILITY, ROLE } from "@repo/config";
import { and, eq, or } from "drizzle-orm";

import { user } from "./identity-schema.ts";

import type { SQL } from "drizzle-orm";

const openProfile: SQL | undefined = and(
  eq(user.visibility, PROFILE_VISIBILITY.allMembers),
  eq(user.emailVerified, true),
  eq(user.role, ROLE.member),
);

function profileVisibleTo(viewerId: string): SQL | undefined {
  return or(eq(user.id, viewerId), openProfile);
}

const profileListed: SQL | undefined = and(openProfile, eq(user.searchable, true));

export { profileListed, profileVisibleTo };
