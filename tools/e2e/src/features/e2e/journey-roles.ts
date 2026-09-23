import { APPLICATION, ROLE, type Application } from "@repo/config";

const journeyRoles = [ROLE.member, "operator", "knowledge"] as const;

type JourneyRole = (typeof journeyRoles)[number];

const roleApplications = {
  knowledge: APPLICATION.wiki,
  member: APPLICATION.user,
  operator: APPLICATION.admin,
} as const satisfies Readonly<Record<JourneyRole, Application>>;

export { journeyRoles, roleApplications };
export type { JourneyRole };
