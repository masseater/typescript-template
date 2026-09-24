import { INVOICE_STATUS, type InvoiceStatus } from "@repo/config";
import { and, desc, eq, lte, type SQL } from "drizzle-orm";
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
  currency: string;
  hostedInvoiceUrl: string | undefined;
  memberId: string;
  originKey: string;
  status: InvoiceStatus;
  stripeInvoiceId: string;
}>;

type StoredInvoice = typeof customerInvoice.$inferSelect;

type InvoiceRecord = Omit<StoredInvoice, "hostedInvoiceUrl" | "updatedAt"> &
  Readonly<{ hostedInvoiceUrl: string | undefined }>;

const asRecord = ({ hostedInvoiceUrl, updatedAt, ...rest }: StoredInvoice): InvoiceRecord => ({
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
    currency: string;
    memberId: string;
    originKey: string;
    status: InvoiceStatus;
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

const unrevised = (webhookEvent: StripeEventRecord, stripeInvoiceId: string): SQL | undefined =>
  and(
    eq(customerInvoice.stripeInvoiceId, stripeInvoiceId),
    lte(customerInvoice.updatedAt, webhookEvent.createdAt),
  );

const invoiceStateWrite = (
  webhookEvent: StripeEventRecord,
  invoiceState: InvoiceState,
): StripeEventWrite => {
  const ledgerValues = {
    amountDue: invoiceState.amountDue,
    amountPaid: invoiceState.amountPaid,
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
  credit: Readonly<{ amountCredited: number; stripeInvoiceId: string }>,
) {
  return yield* applyStripeEvent(webhookEvent, [
    (database): BatchItem<"sqlite"> =>
      database
        .update(customerInvoice)
        .set({ amountCredited: credit.amountCredited, updatedAt: webhookEvent.createdAt })
        .where(unrevised(webhookEvent, credit.stripeInvoiceId)),
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
        .set({ amountRefunded: refund.amountRefunded, updatedAt: webhookEvent.createdAt })
        .where(unrevised(webhookEvent, refund.stripeInvoiceId)),
  ]);
});

const outstandingAmount = (invoice: InvoiceRecord): number =>
  invoice.status === INVOICE_STATUS.void
    ? 0
    : invoice.amountDue - invoice.amountPaid - invoice.amountCredited + invoice.amountRefunded;

export {
  applyInvoiceState,
  creditInvoice,
  findInvoiceOfOrigin,
  listMemberInvoices,
  outstandingAmount,
  recordIssuedInvoice,
  refundInvoice,
  settleInvoicePayment,
};
export type { InvoiceRecord, InvoiceState };
