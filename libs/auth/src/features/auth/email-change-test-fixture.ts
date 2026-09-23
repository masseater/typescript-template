import { emailChangePath } from "./email-change-path.ts";

import type { BrowserClient } from "./browser-client-test-fixture.ts";

const requestEmailChange = (
  client: BrowserClient,
  newEmail: string,
): ReturnType<BrowserClient["json"]> => client.json(emailChangePath, { newEmail });

export { requestEmailChange };
