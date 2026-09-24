import { APPLICATION, ROLE, type Application } from "@repo/config";
import { ADMIN_PERMISSION } from "@repo/config/identity";

const journeyRoles = [ROLE.member, ADMIN_PERMISSION.operator, "knowledge"] as const;

type JourneyRole = (typeof journeyRoles)[number];

const roleApplications = {
  [ADMIN_PERMISSION.operator]: APPLICATION.admin,
  knowledge: APPLICATION.wiki,
  member: APPLICATION.user,
} as const satisfies Readonly<Record<JourneyRole, Application>>;

export { journeyRoles, roleApplications };
export type { JourneyRole };
