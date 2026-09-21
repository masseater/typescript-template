/** @canonical-values db.group-join-policy */
export const groupJoinPolicies = ["invite", "open"] as const;
export type GroupJoinPolicy = (typeof groupJoinPolicies)[number];
export const GROUP_JOIN_POLICY = {
  invite: groupJoinPolicies[0],
  open: groupJoinPolicies[1],
} as const;
