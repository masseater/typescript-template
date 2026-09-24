import { emailChangePath } from "./email-change.ts";

import type { BrowserClient } from "./browser-client-test-fixture.ts";

const requestEmailChange = (
  client: Readonly<BrowserClient>,
  newEmail: string,
): ReturnType<BrowserClient["json"]> => client.json(emailChangePath, { newEmail });

export { requestEmailChange };
