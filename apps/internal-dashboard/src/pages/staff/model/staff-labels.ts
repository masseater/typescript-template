import { STAFF_PERMISSION } from "@repo/config";

import { StaffPermission } from "#shared/contracts/index.ts";

const staffPermissionLabels: Readonly<Record<typeof StaffPermission.Type, string>> = {
  [STAFF_PERMISSION.viewer]: "閲覧のみ",
  [STAFF_PERMISSION.editor]: "変更できる",
};

const staffPermissionOptions = StaffPermission.literals.map((permission) => ({
  label: staffPermissionLabels[permission],
  value: permission,
}));

const staffTableColumns = ["名前", "メールアドレス", "権限", "登録日", "操作"] as const;

const isStaffPermission = (value: string): value is typeof StaffPermission.Type =>
  StaffPermission.literals.some((permission) => permission === value);

export { isStaffPermission, staffPermissionLabels, staffPermissionOptions, staffTableColumns };
