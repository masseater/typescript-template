import { desc, eq, lte } from "drizzle-orm";
import { Effect } from "effect";

import { customerQuote } from "./billing-schema.ts";
import {
  applyStripeEvent,
  subscriptionUpsertWrite,
  type StripeEventRecord,
  type StripeEventWrite,
  type SubscriptionRecord,
} from "./billing.ts";
import { query } from "./database.ts";

import type { BatchItem } from "drizzle-orm/batch";

type StoredQuote = typeof customerQuote.$inferSelect;

const asRecord = ({
  daysUntilDue,
  stripeSubscriptionId,
  updatedAt,
  ...rest
}: StoredQuote): Omit<StoredQuote, "daysUntilDue" | "stripeSubscriptionId" | "updatedAt"> &
  Readonly<{ daysUntilDue: number | undefined; stripeSubscriptionId: string | undefined }> => ({
  ...rest,
  daysUntilDue: daysUntilDue ?? undefined,
  stripeSubscriptionId: stripeSubscriptionId ?? undefined,
});

type QuoteState = Readonly<{
  amountTotal: number;
  collectionMethod: string;
  currency: string;
  daysUntilDue: number | undefined;
  expiresAt: Date;
  memberId: string;
  status: string;
  stripeQuoteId: string;
  stripeSubscriptionId: string | undefined;
}>;

const quoteStateWrite = (
  webhookEvent: StripeEventRecord,
  quoteState: QuoteState,
): StripeEventWrite => {
  const ledgerValues = {
    ...quoteState,
    daysUntilDue: quoteState.daysUntilDue ?? null,
    stripeSubscriptionId: quoteState.stripeSubscriptionId ?? null,
    updatedAt: webhookEvent.createdAt,
  } satisfies typeof customerQuote.$inferInsert;
  return (database): BatchItem<"sqlite"> =>
    database
      .insert(customerQuote)
      .values(ledgerValues)
      .onConflictDoUpdate({
        set: ledgerValues,
        setWhere: lte(customerQuote.updatedAt, webhookEvent.createdAt),
        target: customerQuote.stripeQuoteId,
      });
};

const applyQuoteState = Effect.fn("applyQuoteState")(function* applyQuoteState(
  webhookEvent: StripeEventRecord,
  quoteState: QuoteState,
) {
  return yield* applyStripeEvent(webhookEvent, [quoteStateWrite(webhookEvent, quoteState)]);
});

const acceptQuote = Effect.fn("acceptQuote")(function* acceptQuote(
  webhookEvent: StripeEventRecord,
  acceptance: Readonly<{ quote: QuoteState; subscription: SubscriptionRecord }>,
) {
  return yield* applyStripeEvent(webhookEvent, [
    quoteStateWrite(webhookEvent, acceptance.quote),
    subscriptionUpsertWrite(webhookEvent, acceptance.subscription),
  ]);
});

const listMemberQuotes = Effect.fn("listMemberQuotes")(function* listMemberQuotes(
  memberId: string,
) {
  const storedQuotes = yield* query((database) =>
    database
      .select()
      .from(customerQuote)
      .where(eq(customerQuote.memberId, memberId))
      .orderBy(desc(customerQuote.updatedAt)),
  );
  return storedQuotes.map(asRecord);
});

export { acceptQuote, applyQuoteState, listMemberQuotes };
export type { QuoteState };
