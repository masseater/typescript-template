import {
  onboardingVerdict,
  senderVerdict,
  sendingRecordNames,
  verifiedAddresses,
} from "./email-lookup.ts";
import type { AccountAccess } from "./account-read.ts";
import { CloudflareFailure } from "./config.ts";
import { Effect } from "effect";
import type { SharedConfig } from "./config.ts";
import type { StateService } from "alchemy/State";
import { recordsPresent } from "./account-lookup.ts";

type Onboarding = Effect.Success<ReturnType<typeof onboardingVerdict>>;

function recordClaim(present: boolean, onboarding: Onboarding): "free" | "owned" | "taken" {
  if (!present) {
    return "free";
  }
  return onboarding === "owned" ? "owned" : "taken";
}

const alertQuotaVerdict = Effect.fn("alertQuotaVerdict")(function* alertQuotaVerdict(
  access: AccountAccess,
  recipients: readonly string[],
) {
  const addresses = yield* verifiedAddresses(access).pipe(
    Effect.catchTag("CloudflareFailure", () => Effect.succeed("unreadable" as const)),
  );
  if (typeof addresses === "string") {
    return addresses;
  }
  return recipients.every((recipient) => addresses.includes(recipient))
    ? ("free" as const)
    : ("counted" as const);
});

const emailVerdicts = Effect.fn("emailVerdicts")(function* emailVerdicts<Failure, Requirements>(
  access: AccountAccess,
  config: SharedConfig,
  store: Effect.Effect<StateService, Failure, Requirements>,
) {
  const onboarding = yield* onboardingVerdict(access, config, store);
  const present = yield* recordsPresent(access, config.zoneId, sendingRecordNames(config));
  return {
    emailSending: recordClaim(present, onboarding),
    senderDomain: yield* senderVerdict(access, config),
    sendingSubdomain: onboarding,
  };
});

type EmailVerdicts = Effect.Success<ReturnType<typeof emailVerdicts>>;

function emailBlocked(verdicts: Readonly<EmailVerdicts>): readonly string[] {
  return [
    ...(verdicts.emailSending === "taken" ? ["emailSending"] : []),
    ...(verdicts.senderDomain === "dedicated" ? [] : ["senderDomain"]),
    ...(verdicts.sendingSubdomain === "free" || verdicts.sendingSubdomain === "owned"
      ? []
      : ["sendingSubdomain"]),
  ];
}

const assertSendingDomainUnclaimed = Effect.fn("assertSendingDomainUnclaimed")(
  function* assertSendingDomainUnclaimed<Failure, Requirements>(
    access: AccountAccess,
    config: SharedConfig,
    store: Effect.Effect<StateService, Failure, Requirements>,
  ) {
    const refused = emailBlocked(yield* emailVerdicts(access, config, store));
    if (refused.length === 0) {
      return;
    }
    return yield* Effect.fail(
      new CloudflareFailure({ code: "sending_domain_unavailable", keys: refused }),
    );
  },
);

export { alertQuotaVerdict, assertSendingDomainUnclaimed, emailBlocked, emailVerdicts };
