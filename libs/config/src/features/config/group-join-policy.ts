/** @canonical-values config.group-join-policy */
export const groupJoinPolicies = ["invite_only", "open_join"] as const;
export type GroupJoinPolicy = (typeof groupJoinPolicies)[number];
export const GROUP_JOIN_POLICY = {
  inviteOnly: groupJoinPolicies[0],
  openJoin: groupJoinPolicies[1],
} as const satisfies Record<string, GroupJoinPolicy>;
