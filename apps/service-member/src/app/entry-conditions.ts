import { loginPath, sessionOptions } from "@repo/auth-ui";
import { redirect } from "@tanstack/react-router";

import { blocksMember, loadAgreements } from "#entities/agreement/index.ts";
import { loadMemberFlags } from "#pages/flags/index.ts";
import { loadRecoveryOffer } from "#pages/recovery/index.ts";
import { onboardingOptions } from "#pages/account/welcome/index.ts";

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
  recovery: "/welcome/recovery",
} as const;

async function currentSession(queries: QueryClient): Promise<Session | undefined> {
  return queries.fetchQuery(sessionOptions);
}

async function enterPublicFrame(queries: QueryClient, pathname: string): Promise<void> {
  if (!entrances.has(pathname)) {
    return;
  }
  if ((await currentSession(queries)) !== undefined) {
    throw redirect({ to: "/home" });
  }
}

async function enterMemberFrame(
  queries: QueryClient,
  href: string,
  pathname: string,
): Promise<{ agreements: Agreements; memberBoard: boolean; session: Session }> {
  const session = await currentSession(queries);
  if (session === undefined) {
    throw redirect({ href: loginPath(href) });
  }
  const step = await queries.fetchQuery(onboardingOptions);
  if (step !== "done") {
    const offer = await loadRecoveryOffer();
    if (offer.available && pathname !== welcomePath.recovery) {
      throw redirect({ to: welcomePath.recovery });
    }
    if (pathname !== welcomePath.recovery) {
      throw redirect({ to: welcomePath[step] });
    }
  }
  if (pathname.startsWith("/welcome")) {
    throw redirect({ to: "/home" });
  }
  const agreements = await loadAgreements();
  if (blocksMember(agreements.pending) && pathname !== agreementPath) {
    throw redirect({ search: { redirect: href }, to: agreementPath });
  }
  const memberBoard = await loadMemberFlags();
  return { agreements, memberBoard, session };
}

async function enterWelcomeFrame(
  queries: QueryClient,
  href: string,
): Promise<{ session: Session; step: OnboardingStep }> {
  const session = await currentSession(queries);
  if (session === undefined) {
    throw redirect({ href: loginPath(href) });
  }
  const step = await queries.fetchQuery(onboardingOptions);
  if (step === "done") {
    throw redirect({ to: "/home" });
  }
  const pathname = new URL(href).pathname;
  const offer = await loadRecoveryOffer();
  if (offer.available && pathname !== welcomePath.recovery) {
    throw redirect({ to: welcomePath.recovery });
  }
  if (!offer.available && pathname === welcomePath.recovery) {
    throw redirect({ to: welcomePath[step] });
  }
  return { session, step };
}

export { enterMemberFrame, enterPublicFrame, enterWelcomeFrame, welcomePath };
