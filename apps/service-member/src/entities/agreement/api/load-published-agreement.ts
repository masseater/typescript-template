import { absent, apiDataOrNone } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { PublishedAgreementView } from "#shared/contracts/index.ts";

import type { AgreementKind } from "@repo/config";
import type { ApiReply } from "@repo/runtime/client";

function loadPublishedAgreement(
  kind: AgreementKind,
): Promise<typeof PublishedAgreementView.Type | undefined> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.agreements.published
      .get({ query: { kind } })
      .then((response: ApiReply) =>
        apiDataOrNone(PublishedAgreementView, response, absent.notFound),
      ),
  );
}

export { loadPublishedAgreement };
