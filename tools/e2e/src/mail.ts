import { Effect } from "effect";
import type { Browser } from "./browser.ts";
import { fail, json, mailpit, object, poll, string } from "./support.ts";

export const verificationLink = Effect.fn("verificationLink")(function* (
  text: string,
  origin: string,
) {
  const links = text.match(/https?:\/\/[^\s<>]+/g) ?? [];
  for (const link of links) {
    const url = URL.parse(link);
    if (
      url &&
      url.origin === origin &&
      url.pathname === "/verify-email" &&
      url.search === "" &&
      new URLSearchParams(url.hash.slice(1)).get("token")
    )
      return url.href;
  }
  return yield* fail("E2E_VERIFICATION_LINK_MISSING");
});

export const findMessages = Effect.fn("findMessages")(function* (email: string) {
  const result = yield* object(
    yield* json(
      `${mailpit}/api/v1/search?${new URLSearchParams({ query: `to:${email}`, limit: "100" }).toString()}`,
    ),
  );
  const messages = result["messages"];
  if (!Array.isArray(messages)) return yield* fail("E2E_MAILPIT_INVALID_SEARCH");
  const ids: string[] = [];
  for (const entry of messages as unknown[]) {
    const message = yield* object(entry);
    const recipients = message["To"];
    if (!Array.isArray(recipients)) continue;
    for (const recipient of recipients as unknown[])
      if ((yield* object(recipient))["Address"] === email) {
        ids.push(yield* string(message["ID"]));
        break;
      }
  }
  return ids;
});

export const verifyEmail = Effect.fn("verifyEmail")(function* (
  browser: Browser,
  email: string,
  origin: string,
  owned: Set<string>,
) {
  const messageId = yield* poll(
    Effect.map(findMessages(email), (ids) => ids[0]),
    (id) => id !== undefined,
    "E2E_VERIFICATION_EMAIL_NOT_DELIVERED",
  );
  if (!messageId) return yield* fail("E2E_VERIFICATION_EMAIL_NOT_DELIVERED");
  owned.add(messageId);
  const message = yield* object(
    yield* json(`${mailpit}/api/v1/message/${encodeURIComponent(messageId)}`),
  );
  const link = yield* verificationLink(yield* string(message["Text"]), origin);
  const token = new URLSearchParams(new URL(link).hash.slice(1)).get("token");
  if (!token) return yield* fail("E2E_VERIFICATION_TOKEN_MISSING");
  browser.secrets.add(token);
  browser.secrets.add(email);
  yield* browser.commands(
    ["open", link],
    ["wait", "--url", "**/login"],
    ["wait", 'input[name="email"]'],
  );
});
