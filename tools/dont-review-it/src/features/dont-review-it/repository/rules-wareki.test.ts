import { describe, expect, it } from "vite-plus/test";

import { reported } from "./lint-harness-test-fixture.ts";

const importsFormatter =
  'import { formatWarekiDate } from "@repo/ui"; export const label = formatWarekiDate;';

describe("wareki-in-data-segment", () => {
  it.for([
    ["api", "apps/service-admin/src/pages/users/api/load-users.ts"],
    ["model", "apps/internal-dashboard/src/pages/staff/model/staff-list.ts"],
    ["shared model", "apps/service-member/src/shared/model/plan.ts"],
  ] as const)("rejects the formatter in the %s segment", ([_label, name]) => {
    expect.hasAssertions();
    expect(reported("wareki-in-data-segment", { code: importsFormatter, filename: name })).toBe(
      true,
    );
  });

  it("rejects a renamed date-time formatter", () => {
    expect.hasAssertions();
    expect(
      reported("wareki-in-data-segment", {
        code: 'import { formatWarekiDateTime as at } from "@repo/ui"; export const label = at;',
        filename: "apps/service-member/src/pages/board/model/thread.ts",
      }),
    ).toBe(true);
  });

  it.for([
    ["ui segment", "apps/service-admin/src/pages/users/ui/users-table.tsx", importsFormatter],
    [
      "other imports in the model",
      "apps/service-admin/src/pages/admins/model/admin-list.ts",
      'import { requestAtom } from "@repo/ui"; export const atom = requestAtom;',
    ],
  ] as const)("allows the %s", ([_label, name, code]) => {
    expect.hasAssertions();
    expect(reported("wareki-in-data-segment", { code, filename: name })).toBe(false);
  });
});
