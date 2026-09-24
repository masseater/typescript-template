import { submitConsent } from "@repo/auth-ui";
import { Button, FormColumn } from "@repo/ui";
import { useState } from "react";

import { productName } from "#shared/config/index.ts";

import type { ReactElement } from "react";

function ConsentActions({
  client,
  onError,
}: Readonly<{ client: string; onError: (message: string) => void }>): ReactElement {
  const [pending, setPending] = useState(false);
  function decide(accept: boolean): void {
    setPending(true);
    onError("");
    void submitConsent({ accept }).catch((error: unknown) => {
      onError(error instanceof Error ? error.message : String(error));
      setPending(false);
    });
  }
  function allow(): void {
    decide(true);
  }
  function deny(): void {
    decide(false);
  }
  return (
    <FormColumn>
      <p>
        {client} に {productName} の管理操作を許可しますか？
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" disabled={pending} onClick={allow}>
          許可する
        </Button>
        <Button type="button" disabled={pending} onClick={deny}>
          拒否する
        </Button>
      </div>
    </FormColumn>
  );
}

export { ConsentActions };
