import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { LeaveAccepted, LeaveRequest } from "#shared/contracts/index.ts";

async function submitLeave(values: typeof LeaveRequest.Type): Promise<typeof LeaveAccepted.Type> {
  const { api } = await userClient();
  return apiData(LeaveAccepted, await api.leave.post(values));
}

export { submitLeave };
