import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { AgreementsView } from "#shared/contracts/index.ts";

import type { Agreements } from "#entities/agreement/model/agreements.ts";
import type { AgreementKind } from "@repo/config";

function loadAgreements(): Promise<Agreements> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.agreements.get().then((response) => apiData(AgreementsView, response)),
  );
}

function acceptAgreements(versionIds: readonly string[]): Promise<Agreements> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.agreements.accept
      .post({ versionIds })
      .then((response) => apiData(AgreementsView, response)),
  );
}

function withdrawAgreement(kind: AgreementKind): Promise<Agreements> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.agreements.withdraw.post({ kind }).then((response) => apiData(AgreementsView, response)),
  );
}

export { acceptAgreements, loadAgreements, withdrawAgreement };
