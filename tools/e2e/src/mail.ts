import { ensure, json, mailpit, object, poll, string } from "./support.ts";
import type { BrowserSession } from "./browser.ts";

interface VerificationTarget {
  readonly email: string;
  readonly origin: string;
  readonly ownMessage: (messageId: string) => void;
}

function isVerificationUrl(url: Readonly<URL>, origin: string): boolean {
  return (
    url.origin === origin &&
    url.pathname === "/api/auth/verify-email" &&
    (url.searchParams.get("token") ?? "").length > 0
  );
}

function verificationLink(text: string, origin: string): string {
  const links = text.match(/https?:\/\/[^\s<>]+/gu) ?? [];
  const verification = links.find((link) => isVerificationUrl(new URL(link), origin));
  ensure(verification !== undefined, "E2E_VERIFICATION_LINK_MISSING");
  return new URL(verification).href;
}

function isAddressedTo(entry: unknown, email: string): boolean {
  const recipients = object(entry)["To"];
  return (
    Array.isArray(recipients) &&
    recipients.some((recipient: unknown) => object(recipient)["Address"] === email)
  );
}

async function findMessagesTo(email: string): Promise<string[]> {
  const result = object(
    await json(
      `${mailpit}/api/v1/search?${new URLSearchParams({ limit: "100", query: `to:${email}` }).toString()}`,
    ),
  );
  const { messages } = result;
  ensure(Array.isArray(messages), "E2E_MAILPIT_INVALID_SEARCH");
  return messages
    .filter((entry: unknown) => isAddressedTo(entry, email))
    .map((entry: unknown) => string(object(entry)["ID"]));
}

async function verifyEmail(browser: BrowserSession, target: VerificationTarget): Promise<void> {
  const [messageId] = await poll({
    accept: (ids) => ids.length > 0,
    code: "E2E_VERIFICATION_EMAIL_NOT_DELIVERED",
    read: async () => findMessagesTo(target.email),
  });
  ensure(messageId !== undefined, "E2E_VERIFICATION_EMAIL_NOT_DELIVERED");
  target.ownMessage(messageId);
  const message = object(await json(`${mailpit}/api/v1/message/${encodeURIComponent(messageId)}`));
  const link = verificationLink(string(message["Text"]), target.origin);
  const token = new URL(link).searchParams.get("token");
  ensure(token !== null, "E2E_VERIFICATION_TOKEN_MISSING");
  browser.addSecret(token);
  browser.addSecret(target.email);
  await browser.commands(["open", link], ["wait", 'input[name="email"]']);
}

export { findMessagesTo, verificationLink, verifyEmail };
