import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { ContactAccepted, ContactSubmission } from "#shared/contracts/index.ts";

type ContactFormValues = typeof ContactSubmission.Type;

async function submitContact(values: ContactFormValues): Promise<typeof ContactAccepted.Type> {
  const { api } = await userClient();
  return apiData(ContactAccepted, await api.contact.post(values));
}

export { submitContact };
