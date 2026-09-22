import { apiData } from "@repo/runtime/client";

import { adminClient } from "#shared/api/index.ts";
import { AgreementPublished, AgreementVersionSaved } from "#shared/contracts/index.ts";

import type { AgreementDraft, AgreementDraftRevision } from "#shared/contracts/index.ts";

function createDraft(
  draft: typeof AgreementDraft.Type,
): Promise<typeof AgreementVersionSaved.Type> {
  return adminClient()
    .agreements.post(draft)
    .then((response) => apiData(AgreementVersionSaved, response));
}

function reviseDraft(
  revision: typeof AgreementDraftRevision.Type,
): Promise<typeof AgreementVersionSaved.Type> {
  return adminClient()
    .agreements.patch(revision)
    .then((response) => apiData(AgreementVersionSaved, response));
}

function publishVersion(id: string): Promise<typeof AgreementPublished.Type> {
  return adminClient()
    .agreements.publish.post({ id })
    .then((response) => apiData(AgreementPublished, response));
}

export { createDraft, publishVersion, reviseDraft };
