import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { ContactAccepted, ContactSubmission } from "#shared/contracts/index.ts";

import type { ApiReply } from "@repo/runtime/client";

type ContactFormValues = typeof ContactSubmission.Type;

function submitContact(values: ContactFormValues): Promise<typeof ContactAccepted.Type> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.contact.post(values).then((response: ApiReply) => apiData(ContactAccepted, response)),
  );
}

export { submitContact };
