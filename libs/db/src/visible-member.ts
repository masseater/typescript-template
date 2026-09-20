import { ACCOUNT_STATE, ROLE } from "@repo/config/identity";
import { eq, sql, type SQL } from "drizzle-orm";

import { user } from "./schema.ts";

const visibleMember = (): SQL =>
  sql.join(
    [
      eq(user.role, ROLE.member),
      eq(user.accountState, ACCOUNT_STATE.active),
      eq(user.emailVerified, true),
    ],
    sql` and `,
  );

export { visibleMember };
