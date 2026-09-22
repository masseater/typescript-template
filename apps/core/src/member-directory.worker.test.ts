import { authTest, authTestSecret, registerVerified, runWith, signInAs } from "@repo/auth/testing";
import { APPLICATION, PLAN, ROLE, SUBSCRIPTION_STATUS, WEBHOOK_OUTCOME } from "@repo/config";
import {
  MemberRpcs,
  SessionRequired,
  createRpcFetcher,
  makeCoreClient,
  withForwardedCookies,
} from "@repo/core-api";
import { eq, query, recordSubscription, schema } from "@repo/db";
import { env } from "cloudflare:workers";
import { DateTime, Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import { memberHandlers } from "./handlers.ts";

import type { CoreBindings } from "./bindings.ts";

const { user } = schema;

const coreBindings = (): CoreBindings => ({
  AUTH_SECRET: authTestSecret,
  DB: env.DB,
  EMAIL: {
    send: (): Promise<{ success: true }> => Promise.resolve({ success: true }),
  } as unknown as SendEmail,
  EMAIL_FROM: "sender@example.test",
});

const memberCore = (): Fetcher => {
  const rpcFetch = createRpcFetcher(MemberRpcs, memberHandlers(coreBindings())).fetch;
  return {
    connect: (): never => {
      throw new Error("Core RPC does not open sockets");
    },
    fetch: (input, init) => rpcFetch(new Request(input, init)),
  };
};

const makeSearchable = (email: string) =>
  query((database) => database.update(user).set({ searchable: true }).where(eq(user.email, email)));

describe("memberHandlers directory and billing RPC", () => {
  const it = authTest().extend("listed", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* directoryBilling() {
        yield* registerVerified("directory@example.com");
        yield* registerVerified("peer@example.com");
        yield* makeSearchable("directory@example.com");
        yield* makeSearchable("peer@example.com");
        const signedIn = yield* signInAs(APPLICATION.user, "directory@example.com");
        const client = yield* makeCoreClient(MemberRpcs, memberCore());
        const paidGate = yield* client
          .requirePaidMembership({})
          .pipe(withForwardedCookies(signedIn.cookieHeaders()), Effect.flip);
        const session = yield* client
          .getSession({})
          .pipe(withForwardedCookies(signedIn.cookieHeaders()));
        yield* recordSubscription(
          {
            createdAt: DateTime.toDate(DateTime.nowUnsafe()),
            id: "evt_core_paid",
            type: "customer.subscription.updated",
          },
          {
            cancelAtPeriodEnd: false,
            currentPeriodEnd: undefined,
            memberId: session.user.id,
            status: SUBSCRIPTION_STATUS.active,
            stripeCustomerId: "cus_core",
            stripeSubscriptionId: "sub_core",
          },
        );
        yield* client
          .requirePaidMembership({})
          .pipe(withForwardedCookies(signedIn.cookieHeaders()));
        const members = yield* client
          .listMembers({ limit: 10, offset: 0 })
          .pipe(withForwardedCookies(signedIn.cookieHeaders()));
        const peer = members.members.find((member) => member.name === "peer@example.com");
        const viewed =
          peer === undefined
            ? undefined
            : yield* client
                .getMember({ id: peer.id })
                .pipe(withForwardedCookies(signedIn.cookieHeaders()));
        const plan = yield* client
          .getBillingPlan({})
          .pipe(withForwardedCookies(signedIn.cookieHeaders()));
        const subscription = yield* client
          .getMemberSubscription({})
          .pipe(withForwardedCookies(signedIn.cookieHeaders()));
        const stripe = yield* client.applyStripeEvent({
          created: Math.floor(DateTime.toEpochMillis(DateTime.nowUnsafe()) / 1000),
          data: {
            object: {
              cancel_at_period_end: true,
              customer: "cus_core",
              id: "sub_core",
              metadata: { member_id: subscription?.memberId },
              status: SUBSCRIPTION_STATUS.active,
            },
          },
          id: "evt_core_sync",
          type: "customer.subscription.updated",
        });
        const anonymous = yield* client.listMembers({ limit: 10, offset: 0 }).pipe(Effect.flip);
        return {
          anonymous,
          members: members.members.map((member) => member.name).toSorted(),
          paidGate: paidGate._tag,
          peerFollowing: viewed?.following,
          peerName: viewed?.name,
          plan: plan.plan,
          role: session.user.role,
          stripe: stripe.outcome,
          subscriptionStatus: subscription?.status,
          total: members.total,
        };
      }).pipe(Effect.scoped),
    ),
  );

  it("lists members after paid gate and applies stripe subscription sync", ({ listed }) => {
    expect(listed.paidGate).toBe("PaidPlanRequired");
    expect(listed.members).toStrictEqual(
      expect.arrayContaining(["directory@example.com", "peer@example.com"]),
    );
    expect(listed.total).toBeGreaterThanOrEqual(2);
    expect(listed.peerName).toBe("peer@example.com");
    expect(listed.peerFollowing).toBe(false);
    expect(listed.plan).toBe(PLAN.paid);
    expect(listed.subscriptionStatus).toBe(SUBSCRIPTION_STATUS.active);
    expect(listed.stripe).toBe(WEBHOOK_OUTCOME.applied);
    expect(listed.role).toBe(ROLE.member);
    expect(listed.anonymous).toStrictEqual(new SessionRequired());
  });
});
