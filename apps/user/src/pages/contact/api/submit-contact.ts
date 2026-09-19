import { apiData } from "@repo/runtime/client";
import { ContactAccepted, ContactSubmission } from "@repo/runtime/contracts";

import { userClient } from "#shared/api/index.ts";

type ContactFormValues = typeof ContactSubmission.Type;

async function submitContact(values: ContactFormValues): Promise<typeof ContactAccepted.Type> {
  const { api } = await userClient();
  return apiData(ContactAccepted, await api.contact.post(values));
}

export { submitContact };
