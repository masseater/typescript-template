import { loginPath, sessionOptions } from "@repo/auth-ui";
import { redirect } from "@tanstack/react-router";

import { loadMemberFlags } from "#pages/flags/index.ts";
import { onboardingOptions } from "#pages/welcome/index.ts";

import type { Session } from "#entities/session/index.ts";
import type { OnboardingStep } from "#shared/contracts/index.ts";
import type { QueryClient } from "@tanstack/react-query";

const entrances: ReadonlySet<string> = new Set(["/", "/login", "/signup"]);

const welcomePath = {
  agreement: "/welcome/agreement",
  choose: "/welcome/choose",
  interview: "/welcome/interview",
  profile: "/welcome/profile",
} as const satisfies Readonly<Record<Exclude<OnboardingStep, "done">, string>>;

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
): Promise<{ memberBoard: boolean; session: Session }> {
  const session = await currentSession(queries);
  if (session === undefined) {
    throw redirect({ href: loginPath(href) });
  }
  const step = await queries.fetchQuery(onboardingOptions);
  if (step !== "done") {
    throw redirect({ to: welcomePath[step] });
  }
  if (pathname.startsWith("/welcome")) {
    throw redirect({ to: "/home" });
  }
  const memberBoard = await loadMemberFlags();
  return { memberBoard, session };
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
  return { session, step };
}

export { enterMemberFrame, enterPublicFrame, enterWelcomeFrame, welcomePath };
