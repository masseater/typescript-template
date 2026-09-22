import { loginPath, sessionOptions } from "@repo/auth-ui";
import { redirect } from "@tanstack/react-router";
import { Effect } from "effect";

import { blocksMember, loadAgreements } from "#entities/agreement/index.ts";
import { onboardingOptions } from "#pages/account/welcome/index.ts";
import { loadMemberFlags } from "#pages/flags/index.ts";
import { loadRecoveryOffer } from "#pages/recovery/index.ts";

import type { Agreements } from "#entities/agreement/index.ts";
import type { Session } from "#entities/session/index.ts";
import type { OnboardingStep } from "#shared/contracts/index.ts";
import type { QueryClient } from "@tanstack/react-query";

const entrances: ReadonlySet<string> = new Set(["/", "/login", "/signup"]);

const agreementPath = "/agreement";

const welcomePath = {
  agreement: "/welcome/agreement",
  choose: "/welcome/choose",
  interview: "/welcome/interview",
  profile: "/welcome/profile",
} as const satisfies Readonly<Record<Exclude<OnboardingStep, "done">, string>>;

const recoveryPath = "/welcome/recovery";

function currentSession(queries: QueryClient): Promise<Session | undefined> {
  return queries.fetchQuery(sessionOptions);
}

function enterPublicFrame(queries: QueryClient, pathname: string): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* enterPublic() {
      if (!entrances.has(pathname)) {
        return;
      }
      const session = yield* Effect.promise(() => currentSession(queries));
      if (session !== undefined) {
        throw redirect({ to: "/home" });
      }
    }),
  );
}

function enterMemberFrame(
  queries: QueryClient,
  href: string,
  pathname: string,
): Promise<{ agreements: Agreements; memberBoard: boolean; session: Session }> {
  return Effect.runPromise(
    Effect.gen(function* enterMember() {
      const session = yield* Effect.promise(() => currentSession(queries));
      if (session === undefined) {
        throw redirect({ href: loginPath(href) });
      }
      const step = yield* Effect.promise(() => queries.fetchQuery(onboardingOptions));
      if (step !== "done") {
        const offer = yield* Effect.promise(() => loadRecoveryOffer());
        if (offer.available) {
          throw redirect({ to: recoveryPath });
        }
        throw redirect({ to: welcomePath[step] });
      }
      if (pathname.startsWith("/welcome")) {
        throw redirect({ to: "/home" });
      }
      const agreements = yield* Effect.promise(() => loadAgreements());
      if (blocksMember(agreements.pending) && pathname !== agreementPath) {
        throw redirect({ search: { redirect: href }, to: agreementPath });
      }
      const memberBoard = yield* Effect.promise(() => loadMemberFlags());
      return { agreements, memberBoard, session };
    }),
  );
}

function enterWelcomeFrame(
  queries: QueryClient,
  href: string,
  pathname: string,
): Promise<{ session: Session; step: OnboardingStep }> {
  return Effect.runPromise(
    Effect.gen(function* enterWelcome() {
      const session = yield* Effect.promise(() => currentSession(queries));
      if (session === undefined) {
        throw redirect({ href: loginPath(href) });
      }
      const step = yield* Effect.promise(() => queries.fetchQuery(onboardingOptions));
      if (step === "done") {
        throw redirect({ to: "/home" });
      }
      const offer = yield* Effect.promise(() => loadRecoveryOffer());
      if (offer.available && pathname !== recoveryPath) {
        throw redirect({ to: recoveryPath });
      }
      if (!offer.available && pathname === recoveryPath) {
        throw redirect({ to: welcomePath[step] });
      }
      return { session, step };
    }),
  );
}

export { enterMemberFrame, enterPublicFrame, enterWelcomeFrame, welcomePath };
