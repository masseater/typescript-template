import { Button, FormColumn, STATUS_VARIANT, StatusMessage, localState, useAction } from "@repo/ui";
import { Effect } from "effect";

import { submitDecision } from "#pages/consent/api/consent.ts";
import { serviceName } from "#shared/config/index.ts";

import type { ReactElement } from "react";

const useDecided = localState(false);

function ConsentActions({ client }: Readonly<{ client: string }>): ReactElement {
  const action = useAction();
  const [decided, setDecided] = useDecided();
  function decide(accept: boolean): void {
    action.run(() =>
      Effect.runPromise(
        Effect.gen(function* decideConsent() {
          yield* submitDecision(accept);
          setDecided(true);
        }),
      ),
    );
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
      {action.error !== undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>{action.error}</StatusMessage>
      )}
    </FormColumn>
  );
}

export { ConsentActions };
