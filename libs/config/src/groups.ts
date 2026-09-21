/** @canonical-values db.group-join-policy */
export const groupJoinPolicies = ["group_join_invite", "group_join_open"] as const;
export type GroupJoinPolicy = (typeof groupJoinPolicies)[number];
export const GROUP_JOIN_POLICY = {
  invite: groupJoinPolicies[0],
  open: groupJoinPolicies[1],
} as const;

/** @canonical-values db.group-membership-role */
export const groupMembershipRoles = ["group_role_member", "group_role_owner"] as const;
export type GroupMembershipRole = (typeof groupMembershipRoles)[number];
export const GROUP_MEMBERSHIP_ROLE = {
  member: groupMembershipRoles[0],
  owner: groupMembershipRoles[1],
} as const;
