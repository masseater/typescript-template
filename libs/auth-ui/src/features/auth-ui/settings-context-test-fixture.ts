import { ROLE } from "@repo/config";

import type { SettingsContext } from "./mfa-types";
import type { SessionView } from "./protocol";

const memberUser: SessionView["user"] = {
  email: "taro@example.com",
  id: "user_01",
  name: "山田 太郎",
  permission: null,
  role: ROLE.member,
  twoFactorEnabled: false,
};

const settingsContext = ({
  recovery,
  strong = true,
  user,
}: Readonly<{
  recovery?: string;
  strong?: boolean;
  user?: Partial<SessionView["user"]>;
}> = {}): SettingsContext => ({
  action: { blocked: false, error: undefined, pending: false, run: () => undefined },
  onNotice: () => undefined,
  onNoticeClear: () => undefined,
  recovery,
  session: { strong, user: { ...memberUser, ...user } },
});

export { settingsContext };
