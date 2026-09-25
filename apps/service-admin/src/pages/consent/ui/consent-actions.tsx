import { submitConsent } from "@repo/auth-ui";
import { Button, FailureStatus, FormColumn, useAction } from "@repo/ui";

import { serviceName } from "#shared/config/index.ts";

import type { ReactElement } from "react";

function ConsentActions({ client }: Readonly<{ client: string }>): ReactElement {
  const action = useAction();
  function allow(): void {
    action.run(() => submitConsent({ accept: true }));
  }
  function deny(): void {
    action.run(() => submitConsent({ accept: false }));
  }
  return (
    <FormColumn>
      <p>
        {client} に {serviceName} の管理操作を許可しますか？
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" disabled={action.blocked} onClick={allow}>
          許可する
        </Button>
        <Button type="button" disabled={action.blocked} onClick={deny}>
          拒否する
        </Button>
      </div>
      <FailureStatus error={action.error} />
    </FormColumn>
  );
}

export { ConsentActions };
