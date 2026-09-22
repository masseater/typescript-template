import { SecurityPage as AuthSecurityPage } from "@repo/auth-ui";

import { serviceName } from "#shared/config/index.ts";

import type { ReactElement } from "react";

function SecurityPage(): ReactElement {
  return <AuthSecurityPage title={`${serviceName} の認証設定`} />;
}

export { SecurityPage };
