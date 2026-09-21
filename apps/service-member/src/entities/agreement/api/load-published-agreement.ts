import { absent, apiDataOrNone } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { PublishedAgreementView } from "#shared/contracts/index.ts";

import type { AgreementKind } from "@repo/config";

async function loadPublishedAgreement(
  kind: AgreementKind,
): Promise<typeof PublishedAgreementView.Type | undefined> {
  const { api } = await userClient();
  return apiDataOrNone(
    PublishedAgreementView,
    await api.agreements.published.get({ query: { kind } }),
    absent.notFound,
  );
}

export { loadPublishedAgreement };
