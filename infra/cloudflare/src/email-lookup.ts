import { Effect, Schema } from "effect";
import { endpoint, readPages, readRequired } from "./account-read.ts";
import type { AccountAccess } from "./account-read.ts";
import type { SharedConfig } from "./config.ts";
import { sendingDomain } from "./config.ts";

const ADDRESS_PAGE_SIZE = 50;

const Nullable = Schema.optional(Schema.Union([Schema.String, Schema.Null]));
const Addresses = Schema.Struct({
  result: Schema.Array(Schema.Struct({ email: Nullable, verified: Nullable })),
});
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

const senderVerdict = Effect.fn("senderVerdict")(function* senderVerdict(
  access: AccountAccess,
  config: SharedConfig,
) {
  const zone = yield* readRequired(access, endpoint`zones/${config.zoneId}`, Zone);
  const domain = sendingDomain(config.mailFrom);
  if (domain === zone.result.name) {
    return "zone_apex" as const;
  }
  return domain.endsWith(`.${zone.result.name}`)
    ? ("dedicated" as const)
    : ("outside_zone" as const);
});

export { senderVerdict, sendingRecordNames, verifiedAddresses };
