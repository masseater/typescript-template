import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { AgreementsView } from "#shared/contracts/index.ts";

import type { Agreements } from "#entities/agreement/model/agreements.ts";

async function loadAgreements(): Promise<Agreements> {
  const { api } = await userClient();
  return apiData(AgreementsView, await api.agreements.get());
}

async function acceptAgreements(versionIds: readonly string[]): Promise<Agreements> {
  const { api } = await userClient();
  return apiData(AgreementsView, await api.agreements.accept.post({ versionIds }));
}

export { acceptAgreements, loadAgreements };
