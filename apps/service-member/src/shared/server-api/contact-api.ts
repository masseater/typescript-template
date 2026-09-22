import { sendContactEmail } from "@repo/auth";
import { httpStatus } from "@repo/config";
import { consumeRateLimit } from "@repo/db";
import { authUnavailable, databaseUnavailable } from "@repo/runtime/account";
import { createApi } from "@repo/runtime/http";
import { Effect } from "effect";

import { ContactAccepted, ContactSubmission } from "#shared/contracts/index.ts";
import { OpsMail } from "./ops-mail.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const contactRateLimitMax = 5;
const contactRateLimitWindowMilliseconds = 60 * 60 * 1000;
const contactRateLimitPrefix = "contact:";

const failures = {
  ...authUnavailable,
  ...databaseUnavailable,
  EmailDeliveryFailed: "unexpected" as const,
  RateLimitExceeded: {
    message: "送信回数の上限に達しました。しばらく待ってから再度お試しください。",
    status: httpStatus.tooManyRequests,
  },
};

function clientAddress(headers: Headers): string {
  return headers.get("cf-connecting-ip") ?? "anonymous";
}

const submitContact = Effect.fn("contact.submit")(function* submitContact(
  request: Request,
  submission: typeof ContactSubmission.Type,
) {
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
  return createApi("").post(
    "/contact",
    ...api.route({ body: ContactSubmission, response: ContactAccepted }, submitContact, failures),
  );
}

export { contactApi };
