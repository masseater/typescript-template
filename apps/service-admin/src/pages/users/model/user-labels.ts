import { ROLE } from "@repo/config";

import { Role } from "#shared/contracts/index.ts";

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

function rowConfirmation(
  deleting: boolean,
  user: Readonly<{ email: string; role: typeof Role.Type }>,
): Readonly<{
  confirmLabel: string;
  description: string;
  title: string;
  variant: "danger" | "primary";
}> {
  if (deleting) {
    return {
      confirmLabel: "削除する",
      description: `${user.email} を削除します。この操作は取り消せません。`,
      title: "ユーザーを削除しますか？",
      variant: "danger",
    };
  }
  return {
    confirmLabel: "変更する",
    description: `${user.email} を${roleLabels[nextRoles[user.role]]}に変更します。対象ユーザーの既存セッションは失効します。`,
    title: "権限を変更しますか？",
    variant: "primary",
  };
}

export {
  nextRoles,
  roleLabels,
  rowConfirmation,
  roleOptions,
  verificationLabels,
  verificationOptions,
};
