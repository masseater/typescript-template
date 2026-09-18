import type { StateService } from "alchemy/State";
import { Effect, Schema } from "effect";

import {
  endpoint,
  isUnreadable,
  readList,
  readPages,
  readRequired,
  readVerdict,
  unreadableState,
  unreadableVerdict,
} from "./account-read.ts";
import type { AccountAccess } from "./account-read.ts";
import type { SharedConfig } from "./config.ts";
import { sendingDomain } from "./config.ts";
import { recordedSendingDomains } from "./state-ownership.ts";

const ADDRESS_PAGE_SIZE = 50;
const WILDCARD = "*.";

const Nullable = Schema.optional(Schema.Union([Schema.String, Schema.Null]));
const Addresses = Schema.Struct({
  result: Schema.Array(Schema.Struct({ email: Nullable, verified: Nullable })),
});
const Subdomains = Schema.Struct({ result: Schema.Array(Schema.Struct({ name: Schema.String })) });
const Zone = Schema.Struct({ result: Schema.Struct({ name: Schema.String }) });

function sendingRecordNames(config: SharedConfig): readonly string[] {
  const domain = sendingDomain(config.mailFrom);
  return [`cf-bounce.${domain}`, `cf-bounce._domainkey.${domain}`, `_dmarc.${domain}`];
}

const verifiedAddresses = Effect.fn("verifiedAddresses")(function* verifiedAddresses(
  access: AccountAccess,
) {
  const pages = yield* readPages(
    access,
    {
      pageSize: ADDRESS_PAGE_SIZE,
      source: endpoint`accounts/${access.accountId}/email/routing/addresses`,
    },
    Addresses,
  );
  return pages.flatMap((page) =>
    page.result.flatMap((address) =>
      typeof address.verified === "string" && typeof address.email === "string"
        ? [address.email]
        : [],
    ),
  );
});

const onboardedDomains = Effect.fn("onboardedDomains")(function* onboardedDomains(
  access: AccountAccess,
  zoneId: string,
) {
  const listed = yield* readList(
    access,
    { source: endpoint`zones/${zoneId}/email/sending/subdomains` },
    Subdomains,
  );
  return listed.result.map((subdomain) => subdomain.name);
});

function covers(onboarded: string, domain: string): boolean {
  return onboarded.startsWith(WILDCARD) && domain.endsWith(onboarded.slice(1));
}

const onboardingVerdict = Effect.fn("onboardingVerdict")(function* onboardingVerdict<
  Failure,
  Requirements,
>(
  access: AccountAccess,
  config: SharedConfig,
  store: Effect.Effect<StateService, Failure, Requirements>,
) {
  const onboarded = yield* onboardedDomains(access, config.zoneId).pipe(
    Effect.catchTag("CloudflareFailure", unreadableVerdict),
  );
  if (isUnreadable(onboarded)) {
    return onboarded;
  }
  const domain = sendingDomain(config.mailFrom);
  if (onboarded.some((name) => covers(name, domain))) {
    return "taken" as const;
  }
  if (!onboarded.includes(domain)) {
    return "free" as const;
  }
  const recorded = yield* recordedSendingDomains(store, config.prefix, config.zoneId).pipe(
    Effect.catchCause(unreadableState),
  );
  return readVerdict(recorded, (names) =>
    names.includes(domain) ? ("owned" as const) : ("taken" as const),
  );
});

const senderVerdict = Effect.fn("senderVerdict")(function* senderVerdict(
  access: AccountAccess,
  config: SharedConfig,
) {
  const zone = (yield* readRequired(access, endpoint`zones/${config.zoneId}`, Zone)).result.name;
  const domain = sendingDomain(config.mailFrom);
  if (domain === `${config.prefix}.${zone}`) {
    return "dedicated" as const;
  }
  if (domain === zone) {
    return "zone_apex" as const;
  }
  return domain.endsWith(`.${zone}`) ? ("nested_subdomain" as const) : ("outside_zone" as const);
});

export { onboardingVerdict, senderVerdict, sendingRecordNames, verifiedAddresses };
