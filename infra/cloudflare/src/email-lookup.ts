import { Effect, Schema } from "effect";
import { endpoint, readPages, readRequired } from "./account-read.ts";
import type { AccountAccess } from "./account-read.ts";

const ADDRESS_PAGE_SIZE = 50;

const Nullable = Schema.optional(Schema.Union([Schema.String, Schema.Null]));
const Addresses = Schema.Struct({
  result: Schema.Array(Schema.Struct({ email: Nullable, verified: Nullable })),
});
const Zone = Schema.Struct({ result: Schema.Struct({ name: Schema.String }) });

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

const zoneName = Effect.fn("zoneName")(function* zoneName(access: AccountAccess, zoneId: string) {
  const found = yield* readRequired(access, endpoint`zones/${zoneId}`, Zone);
  return found.result.name;
});

export { verifiedAddresses, zoneName };
