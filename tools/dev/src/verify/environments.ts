import { APPLICATION, applicationOrigins, mailpitOrigin } from "@repo/config";
import { Effect, Schema } from "effect";

import { failure } from "../failure.ts";

import type { LocalCommandFailure } from "../failure.ts";

const verifyEnvironments = ["local", "staging", "production"] as const;

const VerifyEnvironment = Schema.Literals(verifyEnvironments);

type VerifyEnvironmentName = typeof VerifyEnvironment.Type;

type ResolvedVerifyEnvironment = {
  readonly adminOrigin: string;
  readonly environment: VerifyEnvironmentName;
  readonly mailboxUrl?: string;
  readonly mailpitOrigin?: string;
  readonly memberOrigin: string;
  readonly wikiOrigin: string;
};

const requiredOrigin = (
  variable: string,
  value: string | undefined,
): Effect.Effect<string, LocalCommandFailure> => {
  if (value === undefined || value === "") {
    return Effect.fail(failure("credentials_invalid"));
  }
  return Effect.succeed(value);
};

const resolveVerifyEnvironment = Effect.fn("resolveVerifyEnvironment")(
  function* resolveVerifyEnvironment(environment: VerifyEnvironmentName) {
    if (environment === "local") {
      const mailpit = process.env["MAILPIT_URL"] ?? mailpitOrigin;
      return {
        adminOrigin: applicationOrigins[APPLICATION.admin],
        environment,
        mailpitOrigin: mailpit,
        memberOrigin: applicationOrigins[APPLICATION.user],
        wikiOrigin: applicationOrigins[APPLICATION.wiki],
      } satisfies ResolvedVerifyEnvironment;
    }
    const memberOrigin = yield* requiredOrigin(
      "SERVICE_MEMBER_ORIGIN",
      process.env["SERVICE_MEMBER_ORIGIN"],
    );
    const adminOrigin = yield* requiredOrigin(
      "SERVICE_ADMIN_ORIGIN",
      process.env["SERVICE_ADMIN_ORIGIN"],
    );
    const wikiOrigin = yield* requiredOrigin(
      "INTERNAL_DASHBOARD_ORIGIN",
      process.env["INTERNAL_DASHBOARD_ORIGIN"],
    );
    if (environment === "staging") {
      const mailpit = yield* requiredOrigin("MAILPIT_URL", process.env["MAILPIT_URL"]);
      return {
        adminOrigin,
        environment,
        mailpitOrigin: mailpit,
        memberOrigin,
        wikiOrigin,
      } satisfies ResolvedVerifyEnvironment;
    }
    const mailboxUrl = yield* requiredOrigin("AI_MAILBOX_URL", process.env["AI_MAILBOX_URL"]);
    return {
      adminOrigin,
      environment,
      mailboxUrl,
      memberOrigin,
      wikiOrigin,
    } satisfies ResolvedVerifyEnvironment;
  },
);

export { resolveVerifyEnvironment, VerifyEnvironment };
export type { ResolvedVerifyEnvironment };
