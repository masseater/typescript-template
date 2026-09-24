import { SecurityPage as AuthSecurityPage } from "@repo/auth-ui";

import { productName } from "#shared/config/index.ts";

import type { ReactElement } from "react";

function SecurityPage(): ReactElement {
  return <AuthSecurityPage title={`${productName} の認証設定`} />;
}

export { SecurityPage };
