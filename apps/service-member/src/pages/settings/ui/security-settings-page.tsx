import { SecurityPage } from "@repo/auth-ui";

import type { ReactElement } from "react";

function SecuritySettingsPage(): ReactElement {
  return <SecurityPage title="セキュリティ" signedOutPath="/" />;
}

export { SecuritySettingsPage };
