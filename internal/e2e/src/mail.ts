import type { Browser } from "./browser.ts";
import { ensure, json, mailpit, object, poll, string } from "./support.ts";

export function verificationLink(text: string, origin: string): string {
  const links = text.match(/https?:\/\/[^\s<>]+/g) ?? [];
  for (const link of links) {
    const url = new URL(link);
    if (
      url.origin === origin &&
      url.pathname === "/api/auth/verify-email" &&
      url.searchParams.get("token")
    )
      return url.href;
  }
  throw new Error("E2E_VERIFICATION_LINK_MISSING");
}

export async function verifyEmail(
  browser: Browser,
  email: string,
  origin: string,
  owned: Set<string>,
) {
  const messageId = await poll(
    async () => {
      const result = object(
        await json(
          `${mailpit}/api/v1/search?${new URLSearchParams({ query: `to:${email}`, limit: "100" }).toString()}`,
        ),
      );
      const messages = result["messages"];
      ensure(Array.isArray(messages), "E2E_MAILPIT_INVALID_SEARCH");
      for (const entry of messages) {
        const message = object(entry);
        const recipients = message["To"];
        if (
          Array.isArray(recipients) &&
          recipients.some((recipient: unknown) => object(recipient)["Address"] === email)
        )
          return string(message["ID"]);
      }
      return undefined;
    },
    (id) => id !== undefined,
    "E2E_VERIFICATION_EMAIL_NOT_DELIVERED",
  );
  ensure(messageId, "E2E_VERIFICATION_EMAIL_NOT_DELIVERED");
  owned.add(messageId);
  const message = object(await json(`${mailpit}/api/v1/message/${encodeURIComponent(messageId)}`));
  const link = verificationLink(string(message["Text"]), origin);
  const token = new URL(link).searchParams.get("token");
  ensure(token, "E2E_VERIFICATION_TOKEN_MISSING");
  browser.secrets.add(token);
  browser.secrets.add(email);
  await browser.commands(["open", link], ["wait", 'input[name="email"]']);
}
