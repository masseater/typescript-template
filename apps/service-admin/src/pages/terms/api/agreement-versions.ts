import { apiData } from "@repo/runtime/client";

import { adminClient } from "#shared/api/index.ts";
import { AgreementPublished, AgreementVersionSaved } from "#shared/contracts/index.ts";

import type { AgreementDraft, AgreementDraftRevision } from "#shared/contracts/index.ts";

async function createDraft(
  draft: typeof AgreementDraft.Type,
): Promise<typeof AgreementVersionSaved.Type> {
  return apiData(AgreementVersionSaved, await adminClient().agreements.post(draft));
}

async function reviseDraft(
  revision: typeof AgreementDraftRevision.Type,
): Promise<typeof AgreementVersionSaved.Type> {
  return apiData(AgreementVersionSaved, await adminClient().agreements.patch(revision));
}

async function publishVersion(id: string): Promise<typeof AgreementPublished.Type> {
  return apiData(AgreementPublished, await adminClient().agreements.publish.post({ id }));
}

export { createDraft, publishVersion, reviseDraft };
