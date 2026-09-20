import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { RecoverAccepted, RecoverRequest } from "#shared/contracts/index.ts";

async function submitRecover(
  values: typeof RecoverRequest.Type,
): Promise<typeof RecoverAccepted.Type> {
  const { api } = await userClient();
  return apiData(RecoverAccepted, await api.recover.post(values));
}

export { submitRecover };
