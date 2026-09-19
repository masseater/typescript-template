import { Role } from "@repo/runtime/contracts";

const roleLabels: Readonly<Record<typeof Role.Type, string>> = {
  admin: "管理者",
  member: "一般ユーザー",
};

const nextRoles: Readonly<Record<typeof Role.Type, typeof Role.Type>> = {
  admin: "member",
  member: "admin",
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
