import type { BrowserClient } from "./browser-client.ts";

const emailChangePath = "/change-email";

const requestEmailChange = (
  client: BrowserClient,
  newEmail: string,
): ReturnType<BrowserClient["json"]> => client.json(emailChangePath, { newEmail });

export { emailChangePath, requestEmailChange };
