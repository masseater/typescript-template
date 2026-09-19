import type { Application } from "@repo/config";

const journeyRoles = ["member", "operator", "knowledge"] as const;

type JourneyRole = (typeof journeyRoles)[number];

const roleApplications = {
  knowledge: "wiki",
  member: "user",
  operator: "admin",
} as const satisfies Readonly<Record<JourneyRole, Application>>;

export { journeyRoles, roleApplications };
export type { JourneyRole };
