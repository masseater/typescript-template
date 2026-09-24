import { desc, eq, lte, sql } from "drizzle-orm";
import { Effect } from "effect";

import { customerInvoice } from "./billing-schema.ts";
import {
  applyStripeEvent,
  recoverSubscriptionWrite,
  type StripeEventRecord,
  type StripeEventWrite,
} from "./billing.ts";
import { clockDate } from "./clock-date.ts";
import { query } from "./database.ts";

import type { BatchItem } from "drizzle-orm/batch";

type InvoiceState = Readonly<{
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  currency: string;
  hostedInvoiceUrl: string | undefined;
  memberId: string;
  originKey: string;
  status: string;
  stripeInvoiceId: string;
}>;

type StoredInvoice = typeof customerInvoice.$inferSelect;

const asRecord = ({
  hostedInvoiceUrl,
  updatedAt,
  ...rest
}: StoredInvoice): Omit<StoredInvoice, "hostedInvoiceUrl" | "updatedAt"> &
  Readonly<{ hostedInvoiceUrl: string | undefined }> => ({
  ...rest,
  hostedInvoiceUrl: hostedInvoiceUrl ?? undefined,
});

const findInvoiceOfOrigin = Effect.fn("findInvoiceOfOrigin")(function* findInvoiceOfOrigin(
  originKey: string,
) {
  const [storedInvoice] = yield* query((database) =>
    database
      .select()
      .from(customerInvoice)
      .where(eq(customerInvoice.originKey, originKey))
      .limit(1),
  );
  return storedInvoice === undefined ? undefined : asRecord(storedInvoice);
});

const listMemberInvoices = Effect.fn("listMemberInvoices")(function* listMemberInvoices(
  memberId: string,
) {
  const storedInvoices = yield* query((database) =>
    database
      .select()
      .from(customerInvoice)
      .where(eq(customerInvoice.memberId, memberId))
      .orderBy(desc(customerInvoice.issuedAt)),
  );
  return storedInvoices.map(asRecord);
});

const recordIssuedInvoice = Effect.fn("recordIssuedInvoice")(function* recordIssuedInvoice(
  issued: Readonly<{
    amountDue: number;
    amountRemaining: number;
    currency: string;
    memberId: string;
    originKey: string;
    status: string;
    stripeInvoiceId: string;
  }>,
) {
  const issuedAt = yield* clockDate;
  yield* query((database) =>
    database
      .insert(customerInvoice)
      .values({ ...issued, issuedAt, updatedAt: issuedAt })
      .onConflictDoNothing(),
  );
});

const invoiceStateWrite = (
  webhookEvent: StripeEventRecord,
  invoiceState: InvoiceState,
): StripeEventWrite => {
  const ledgerValues = {
    amountDue: invoiceState.amountDue,
    amountPaid: invoiceState.amountPaid,
    amountRemaining: invoiceState.amountRemaining,
    currency: invoiceState.currency,
    hostedInvoiceUrl: invoiceState.hostedInvoiceUrl ?? null,
    issuedAt: webhookEvent.createdAt,
    memberId: invoiceState.memberId,
    originKey: invoiceState.originKey,
    status: invoiceState.status,
    stripeInvoiceId: invoiceState.stripeInvoiceId,
    updatedAt: webhookEvent.createdAt,
  } satisfies typeof customerInvoice.$inferInsert;
  return (database): BatchItem<"sqlite"> =>
    database
      .insert(customerInvoice)
      .values(ledgerValues)
      .onConflictDoUpdate({
        set: {
          amountDue: ledgerValues.amountDue,
          amountPaid: ledgerValues.amountPaid,
          amountRemaining: ledgerValues.amountRemaining,
          currency: ledgerValues.currency,
          hostedInvoiceUrl: ledgerValues.hostedInvoiceUrl,
          status: ledgerValues.status,
          updatedAt: ledgerValues.updatedAt,
        },
        setWhere: lte(customerInvoice.updatedAt, webhookEvent.createdAt),
        target: customerInvoice.stripeInvoiceId,
      });
};

const applyInvoiceState = Effect.fn("applyInvoiceState")(function* applyInvoiceState(
  webhookEvent: StripeEventRecord,
  invoiceState: InvoiceState,
) {
  return yield* applyStripeEvent(webhookEvent, [invoiceStateWrite(webhookEvent, invoiceState)]);
});

const settleInvoicePayment = Effect.fn("settleInvoicePayment")(function* settleInvoicePayment(
  webhookEvent: StripeEventRecord,
  payment: Readonly<{ invoice: InvoiceState; stripeSubscriptionId: string | undefined }>,
) {
  return yield* applyStripeEvent(webhookEvent, [
    invoiceStateWrite(webhookEvent, payment.invoice),
    ...(payment.stripeSubscriptionId === undefined
      ? []
      : [recoverSubscriptionWrite(webhookEvent, payment.stripeSubscriptionId)]),
  ]);
});

const creditInvoice = Effect.fn("creditInvoice")(function* creditInvoice(
  webhookEvent: StripeEventRecord,
  credit: Readonly<{ amount: number; stripeInvoiceId: string }>,
) {
  return yield* applyStripeEvent(webhookEvent, [
    (database): BatchItem<"sqlite"> =>
      database
        .update(customerInvoice)
        .set({ amountCredited: sql`${customerInvoice.amountCredited} + ${credit.amount}` })
        .where(eq(customerInvoice.stripeInvoiceId, credit.stripeInvoiceId)),
  ]);
});

const refundInvoice = Effect.fn("refundInvoice")(function* refundInvoice(
  webhookEvent: StripeEventRecord,
  refund: Readonly<{ amountRefunded: number; stripeInvoiceId: string }>,
) {
  return yield* applyStripeEvent(webhookEvent, [
    (database): BatchItem<"sqlite"> =>
      database
        .update(customerInvoice)
        .set({
          amountRefunded: sql`max(${customerInvoice.amountRefunded}, ${refund.amountRefunded})`,
        })
        .where(eq(customerInvoice.stripeInvoiceId, refund.stripeInvoiceId)),
  ]);
});

export {
  applyInvoiceState,
  creditInvoice,
  findInvoiceOfOrigin,
  listMemberInvoices,
  recordIssuedInvoice,
  refundInvoice,
  settleInvoicePayment,
};
export type { InvoiceState };
