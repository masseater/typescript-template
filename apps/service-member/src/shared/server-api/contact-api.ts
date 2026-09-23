import { sendContactEmail } from "@repo/auth";
import { httpStatus } from "@repo/config";
import { consumeRateLimit } from "@repo/db";
import { unavailable } from "@repo/runtime/account";
import { createApi, readJsonBody } from "@repo/runtime/http";
import { Effect } from "effect";

import { ContactAccepted, ContactSubmission } from "#shared/contracts/index.ts";
import { OpsMail } from "./ops-mail.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const contactRateLimitMax = 5;
const contactRateLimitWindowMilliseconds = 60 * 60 * 1000;
const contactRateLimitPrefix = "contact:";

const failures = {
  ...unavailable,
  EmailDeliveryFailed: "unexpected" as const,
  RateLimitExceeded: {
    message: "送信回数の上限に達しました。しばらく待ってから再度お試しください。",
    status: httpStatus.tooManyRequests,
  },
};

function clientAddress(headers: Headers): string {
  return headers.get("cf-connecting-ip") ?? "anonymous";
}

const submitContact = Effect.fn("contact.submit")(function* submitContact(request: Request) {
  const submission = yield* readJsonBody(ContactSubmission, request);
  yield* consumeRateLimit(
    `${contactRateLimitPrefix}${clientAddress(request.headers)}`,
    contactRateLimitMax,
    contactRateLimitWindowMilliseconds,
  );
  const mail = yield* OpsMail;
  yield* sendContactEmail(mail, { submission, to: mail.OPS_EMAIL });
  return { ok: true as const };
});

function contactApi(api: ApiRoutes<AppServices | OpsMail>) {
  return createApi("").post("/contact", api.route(ContactAccepted, submitContact, failures));
}

export { contactApi };
