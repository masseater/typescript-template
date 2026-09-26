import { APPLICATION, type Application } from "@repo/config";

/** @canonical-values e2e.journey-role */
const journeyRoles = ["member", "operator", "knowledge"] as const;

type JourneyRole = (typeof journeyRoles)[number];

const JOURNEY_ROLE = {
  member: journeyRoles[0],
  operator: journeyRoles[1],
  knowledge: journeyRoles[2],
} as const;

const roleApplications = {
  knowledge: APPLICATION.internalDashboard,
  member: APPLICATION.serviceMember,
  operator: APPLICATION.serviceAdmin,
} as const satisfies Readonly<Record<JourneyRole, Application>>;

export { JOURNEY_ROLE, journeyRoles, roleApplications };
export type { JourneyRole };
