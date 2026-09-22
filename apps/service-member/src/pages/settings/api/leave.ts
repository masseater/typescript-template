import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { LeaveAccepted, LeaveRequest } from "#shared/contracts/index.ts";

function submitLeave(values: typeof LeaveRequest.Type): Promise<typeof LeaveAccepted.Type> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.leave.post(values).then((response) => apiData(LeaveAccepted, response)),
  );
}

export { submitLeave };
