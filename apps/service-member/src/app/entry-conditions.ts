import { loginPath } from "@repo/ui";
import { redirect } from "@tanstack/react-router";

import { loadSession } from "#entities/session/index.ts";
import { loadOnboardingStep } from "#pages/welcome/index.ts";

import type { Session } from "#entities/session/index.ts";
import type { OnboardingStep } from "#shared/contracts/index.ts";

const entrances: ReadonlySet<string> = new Set(["/", "/login", "/signup"]);

const welcomePath = {
  agreement: "/welcome/agreement",
  choose: "/welcome",
  interview: "/welcome/interview",
  profile: "/welcome/profile",
} as const satisfies Readonly<Record<Exclude<OnboardingStep, "done">, string>>;

async function enterPublicFrame(pathname: string): Promise<void> {
  if (!entrances.has(pathname)) {
    return;
  }
  const session = await loadSession();
  if (session !== undefined) {
    throw redirect({ to: "/home" });
  }
}

async function enterMemberFrame(href: string, pathname: string): Promise<{ session: Session }> {
  const session = await loadSession();
  if (session === undefined) {
    throw redirect({ href: loginPath(href) });
  }
  const step = await loadOnboardingStep();
  if (step !== "done") {
    throw redirect({ to: welcomePath[step] });
  }
  if (pathname.startsWith("/welcome")) {
    throw redirect({ to: "/home" });
  }
  return { session };
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
  return { session, step };
}

export { enterMemberFrame, enterPublicFrame, enterWelcomeFrame, welcomePath };
