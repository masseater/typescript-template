import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { LeaveAccepted, LeaveRequest } from "#shared/contracts/index.ts";

import type { ApiReply } from "@repo/runtime/client";

function submitLeave(values: typeof LeaveRequest.Type): Promise<typeof LeaveAccepted.Type> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.leave.post(values).then((response: ApiReply) => apiData(LeaveAccepted, response)),
  );
}

export { submitLeave };
