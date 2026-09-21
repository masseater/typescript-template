import { ACCOUNT_STATE, ADMIN_PERMISSION } from "@repo/config";

import { AccountState, AdminPermission } from "#shared/contracts/index.ts";

const adminPermissionLabels: Readonly<Record<typeof AdminPermission.Type, string>> = {
  [ADMIN_PERMISSION.viewer]: "閲覧のみ",
  [ADMIN_PERMISSION.operator]: "操作できる",
  [ADMIN_PERMISSION.owner]: "管理者を追加できる",
};

const adminPermissionOptions = AdminPermission.literals.map((permission) => ({
  label: adminPermissionLabels[permission],
  value: permission,
}));

const adminStateLabels: Readonly<Record<typeof AccountState.Type, string>> = {
  [ACCOUNT_STATE.active]: "有効",
  [ACCOUNT_STATE.suspended]: "無効",
};

const adminStateChangeLabels: Readonly<Record<typeof AccountState.Type, string>> = {
  [ACCOUNT_STATE.active]: "無効にする",
  [ACCOUNT_STATE.suspended]: "有効にする",
};

const adminsTableColumns = ["名前", "メールアドレス", "権限", "状態", "登録日", "操作"] as const;

export {
  adminPermissionLabels,
  adminPermissionOptions,
  adminStateChangeLabels,
  adminStateLabels,
  adminsTableColumns,
};
