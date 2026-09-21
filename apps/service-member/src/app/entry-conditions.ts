import { loginPath } from "@repo/auth-ui";
import { redirect } from "@tanstack/react-router";

import { loadSession } from "#entities/session/index.ts";
import { loadMemberFlags } from "#pages/flags/index.ts";
import { loadRecoveryOffer } from "#pages/recovery/index.ts";
import { loadOnboardingStep } from "#pages/welcome/index.ts";

import type { Session } from "#entities/session/index.ts";
import type { OnboardingStep } from "#shared/contracts/index.ts";

const entrances: ReadonlySet<string> = new Set(["/", "/login", "/signup"]);

const welcomePath = {
  agreement: "/welcome/agreement",
  choose: "/welcome/choose",
  interview: "/welcome/interview",
  profile: "/welcome/profile",
} as const satisfies Readonly<Record<Exclude<OnboardingStep, "done">, string>>;

const recoveryPath = "/welcome/recovery";

async function enterPublicFrame(pathname: string): Promise<void> {
  if (!entrances.has(pathname)) {
    return;
  }
  const session = await loadSession();
  if (session !== undefined) {
    throw redirect({ to: "/home" });
  }
}

async function enterMemberFrame(
  href: string,
  pathname: string,
): Promise<{ memberBoard: boolean; session: Session }> {
  const session = await loadSession();
  if (session === undefined) {
    throw redirect({ href: loginPath(href) });
  }
  const step = await loadOnboardingStep();
  if (step !== "done") {
    const offer = await loadRecoveryOffer();
    if (offer.available) {
      throw redirect({ to: recoveryPath });
    }
    throw redirect({ to: welcomePath[step] });
  }
  if (pathname.startsWith("/welcome")) {
    throw redirect({ to: "/home" });
  }
  const memberBoard = await loadMemberFlags();
  return { memberBoard, session };
}

async function enterWelcomeFrame(
  href: string,
): Promise<{ session: Session; step: OnboardingStep }> {
  const session = await loadSession();
  if (session === undefined) {
    throw redirect({ href: loginPath(href) });
  }
  const step = await loadOnboardingStep();
  if (step === "done") {
    throw redirect({ to: "/home" });
  }
  const pathname = new URL(href).pathname;
  const offer = await loadRecoveryOffer();
  if (offer.available && pathname !== recoveryPath) {
    throw redirect({ to: recoveryPath });
  }
  if (!offer.available && pathname === recoveryPath) {
    throw redirect({ to: welcomePath[step] });
  }
  return { session, step };
}

export { enterMemberFrame, enterPublicFrame, enterWelcomeFrame, welcomePath };
