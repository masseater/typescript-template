import { ROLE } from "@repo/config";
import { Role } from "@repo/runtime/contracts";

const roleLabels: Readonly<Record<typeof Role.Type, string>> = {
  [ROLE.administrator]: "管理者",
  [ROLE.member]: "一般ユーザー",
};

const nextRoles: Readonly<Record<typeof Role.Type, typeof Role.Type>> = {
  [ROLE.administrator]: ROLE.member,
  [ROLE.member]: ROLE.administrator,
};

const verificationLabels = { false: "未確認", true: "確認済み" } as const;

const roleOptions = [
  { label: "すべて", value: "" },
  ...Role.literals.map((role) => ({ label: roleLabels[role], value: role })),
];

const verificationOptions = [
  { label: "すべて", value: "" },
  { label: verificationLabels.true, value: "true" },
  { label: verificationLabels.false, value: "false" },
];

export { nextRoles, roleLabels, roleOptions, verificationLabels, verificationOptions };
