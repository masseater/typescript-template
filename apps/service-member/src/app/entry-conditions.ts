import { loginPath, sessionOptions, type SessionView } from "@repo/auth-ui";
import { redirect } from "@tanstack/react-router";
import { Effect } from "effect";

import { blocksMember, loadAgreements } from "#entities/agreement/index.ts";
import { loadSession } from "#entities/session/index.ts";
import { loadOnboardingStep, onboardingOptions } from "#pages/account/welcome/index.ts";
import { loadRecoveryOffer } from "#pages/recovery/index.ts";

import type { Agreements } from "#entities/agreement/index.ts";
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

const currentSession = (queries: QueryClient): Effect.Effect<SessionView | undefined> =>
  Effect.promise(() => loadSession()).pipe(
    Effect.tap((session) =>
      Effect.sync(() => queries.setQueryData(sessionOptions.queryKey, session)),
    ),
  );

const currentOnboardingStep = (queries: QueryClient): Effect.Effect<OnboardingStep> =>
  Effect.promise(() => loadOnboardingStep()).pipe(
    Effect.tap((step) => Effect.sync(() => queries.setQueryData(onboardingOptions.queryKey, step))),
  );

function enterPublicFrame(queries: QueryClient, pathname: string): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* enterPublic() {
      if (!entrances.has(pathname)) {
        return;
      }
      const session = yield* currentSession(queries);
      if (session !== undefined) {
        throw redirect({ to: "/home" });
      }
    }),
  );
}

type PendingStep = Exclude<OnboardingStep, "done">;

const signedIn = (session: SessionView | undefined, href: string): SessionView => {
  if (session === undefined) {
    throw redirect({ href: loginPath(href) });
  }
  return session;
};

const pendingStep = (step: OnboardingStep): PendingStep => {
  if (step === "done") {
    throw redirect({ to: "/home" });
  }
  return step;
};

const requireOnboarded = (queries: QueryClient): Effect.Effect<void> =>
  Effect.gen(function* requireOnboarded() {
    const step = yield* currentOnboardingStep(queries);
    if (step === "done") {
      return;
    }
    const offer = yield* Effect.promise(() => loadRecoveryOffer());
    throw redirect({ to: offer.available ? recoveryPath : welcomePath[step] });
  });

const leaveWelcome = (pathname: string): void => {
  if (pathname.startsWith("/welcome")) {
    throw redirect({ to: "/home" });
  }
};

const requireAgreed = (agreements: Agreements, href: string, pathname: string): void => {
  if (blocksMember(agreements.pending) && pathname !== agreementPath) {
    throw redirect({ search: { redirect: href }, to: agreementPath });
  }
};

const settleRecovery = (available: boolean, pathname: string, step: PendingStep): void => {
  if (available !== (pathname === recoveryPath)) {
    throw redirect({ to: available ? recoveryPath : welcomePath[step] });
  }
};

function enterMemberFrame(
  queries: QueryClient,
  href: string,
  pathname: string,
): Promise<{ agreements: Agreements; session: SessionView }> {
  return Effect.runPromise(
    Effect.gen(function* enterMember() {
      const session = signedIn(yield* currentSession(queries), href);
      yield* requireOnboarded(queries);
      leaveWelcome(pathname);
      const agreements = yield* Effect.promise(() => loadAgreements());
      requireAgreed(agreements, href, pathname);
      return { agreements, session };
    }),
  );
}

function enterWelcomeFrame(
  queries: QueryClient,
  href: string,
  pathname: string,
): Promise<{ session: SessionView; step: OnboardingStep }> {
  return Effect.runPromise(
    Effect.gen(function* enterWelcome() {
      const session = signedIn(yield* currentSession(queries), href);
      const step = pendingStep(yield* currentOnboardingStep(queries));
      const offer = yield* Effect.promise(() => loadRecoveryOffer());
      settleRecovery(offer.available, pathname, step);
      return { session, step };
    }),
  );
}

export { enterMemberFrame, enterPublicFrame, enterWelcomeFrame, welcomePath };
