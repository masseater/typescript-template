import { TextLink } from "@repo/ui";

import { agreementKindLabels, agreementKindPaths } from "#entities/agreement/model/agreements.ts";

import type { Pending } from "#entities/agreement/model/agreements.ts";
import type { ReactElement } from "react";

function PendingAgreementList({
  pending,
}: Readonly<{ pending: readonly Pending[] }>): ReactElement {
  return (
    <ul className="flex flex-col gap-2 text-base leading-normal text-foreground">
      {pending.map((agreement) => (
        <li key={agreement.id} className="flex flex-col gap-1">
          <TextLink to={agreementKindPaths[agreement.kind]}>
            {agreementKindLabels[agreement.kind]}（{agreement.version}）
          </TextLink>
          {agreement.summary !== null && (
            <p className="text-sm leading-normal text-muted-foreground">{agreement.summary}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export { PendingAgreementList };
