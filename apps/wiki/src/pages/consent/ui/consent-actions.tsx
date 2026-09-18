import { Button, FormColumn, Status, localState, useAction } from "@template/ui";
import type { ReactElement } from "react";
import { serviceName } from "#shared/config/index.ts";
import { submitDecision } from "#pages/consent/api/consent.ts";

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
  function allow(): void {
    decide(true);
  }
  function deny(): void {
    decide(false);
  }
  const disabled = action.blocked || decided;
  return (
    <FormColumn>
      <p>
        {client} に {serviceName} の閲覧を許可しますか？
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" disabled={disabled} onClick={allow}>
          許可する
        </Button>
        <Button type="button" disabled={disabled} onClick={deny}>
          拒否する
        </Button>
      </div>
      {action.error !== undefined && <Status variant="error">{action.error}</Status>}
    </FormColumn>
  );
}

export { ConsentActions };
