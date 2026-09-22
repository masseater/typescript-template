import { SecurityPage as AuthSecurityPage } from "@repo/auth-ui";

import type { ReactElement } from "react";

function SecurityPage(): ReactElement {
  return <AuthSecurityPage title="認証設定" />;
}

export { SecurityPage };
