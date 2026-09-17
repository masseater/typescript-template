import type { ReactElement } from "react";
import { SecurityPage } from "@template/ui/auth";
import { UIProvider } from "@template/ui";

function WikiSecurity(): ReactElement {
  return (
    <UIProvider>
      <SecurityPage title="Wiki の認証設定" />
    </UIProvider>
  );
}

export { WikiSecurity };
