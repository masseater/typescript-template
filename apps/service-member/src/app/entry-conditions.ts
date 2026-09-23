import { loginPath, sessionOptions } from "@repo/auth-ui";
import { redirect } from "@tanstack/react-router";
import { Effect } from "effect";

import { blocksMember, loadAgreements } from "#entities/agreement/index.ts";
import { onboardingOptions } from "#pages/account/welcome/index.ts";
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

function signedIn(queries: QueryClient, href: string): Effect.Effect<Session> {
  return Effect.gen(function* requireSession() {
    const session = yield* Effect.promise(() => currentSession(queries));
    if (session === undefined) {
      throw redirect({ href: loginPath(href) });
    }
    return session;
  });
}

function onboardingStep(queries: QueryClient): Effect.Effect<OnboardingStep> {
  return Effect.promise(() => queries.fetchQuery(onboardingOptions));
}

function recoveryAvailable(): Effect.Effect<boolean> {
  return Effect.promise(() => loadRecoveryOffer()).pipe(Effect.map((offer) => offer.available));
}

function resumeOnboarding(step: Exclude<OnboardingStep, "done">): Effect.Effect<never> {
  return Effect.gen(function* redirectToOnboarding() {
    const available = yield* recoveryAvailable();
    throw redirect({ to: available ? recoveryPath : welcomePath[step] });
  });
}

function leaveWelcome(pathname: string): void {
  if (pathname.startsWith("/welcome")) {
    throw redirect({ to: "/home" });
  }
}

function requireAgreement(agreements: Agreements, href: string, pathname: string): void {
  if (blocksMember(agreements.pending) && pathname !== agreementPath) {
    throw redirect({ search: { redirect: href }, to: agreementPath });
  }
}

function matchRecovery(
  available: boolean,
  pathname: string,
  step: Exclude<OnboardingStep, "done">,
): void {
  if (available !== (pathname === recoveryPath)) {
    throw redirect({ to: available ? recoveryPath : welcomePath[step] });
  }
}

function enterMemberFrame(
  queries: QueryClient,
  href: string,
  pathname: string,
): Promise<{ agreements: Agreements; session: Session }> {
  return Effect.runPromise(
    Effect.gen(function* enterMember() {
      const session = yield* signedIn(queries, href);
      const step = yield* onboardingStep(queries);
      if (step !== "done") {
        return yield* resumeOnboarding(step);
      }
      leaveWelcome(pathname);
      const agreements = yield* Effect.promise(() => loadAgreements());
      requireAgreement(agreements, href, pathname);
      return { agreements, session };
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
      const session = yield* signedIn(queries, href);
      const step = yield* onboardingStep(queries);
      if (step === "done") {
        throw redirect({ to: "/home" });
      }
      matchRecovery(yield* recoveryAvailable(), pathname, step);
      return { session, step };
    }),
  );
}

export { enterMemberFrame, enterPublicFrame, enterWelcomeFrame, welcomePath };
