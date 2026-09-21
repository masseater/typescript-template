import { Button, FormColumn, STATUS_VARIANT, StatusMessage, localState, useAction } from "@repo/ui";

import { submitDecision } from "#pages/account/consent/api/consent.ts";
import { serviceName } from "#shared/config/index.ts";

import type { ReactElement } from "react";

const useDecided = localState(false);

function ConsentActions({ client }: Readonly<{ client: string }>): ReactElement {
  const action = useAction();
  const [decided, setDecided] = useDecided();
  function decide(accept: boolean): void {
    action.run(async () => {
      await submitDecision(accept);
      setDecided(true);
    });
  }
  const disabled = action.blocked || decided;
  return (
    <FormColumn>
      <p>
        {client} に {serviceName} の操作を許可しますか？
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={disabled}
          onClick={() => {
            decide(true);
          }}
          type="button"
          variant="primary"
        >
          許可する
        </Button>
        <Button
          disabled={disabled}
          onClick={() => {
            decide(false);
          }}
          type="button"
        >
          拒否する
        </Button>
      </div>
      {action.error !== undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>{action.error}</StatusMessage>
      )}
    </FormColumn>
  );
}

export { ConsentActions };
