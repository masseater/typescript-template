import { loginPath } from "@repo/auth-ui";
import { redirect } from "@tanstack/react-router";
import { Effect } from "effect";

import { loadSession } from "#entities/session/index.ts";
import { loadMemberFlags } from "#pages/flags/index.ts";
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

function enterPublicFrame(pathname: string): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* enterPublic() {
      if (!entrances.has(pathname)) {
        return;
      }
      const session = yield* Effect.promise(() => loadSession());
      if (session !== undefined) {
        throw redirect({ to: "/home" });
      }
    }),
  );
}

function enterMemberFrame(
  href: string,
  pathname: string,
): Promise<{ memberBoard: boolean; session: Session }> {
  return Effect.runPromise(
    Effect.gen(function* enterMember() {
      const session = yield* Effect.promise(() => loadSession());
      if (session === undefined) {
        throw redirect({ href: loginPath(href) });
      }
      const step = yield* Effect.promise(() => loadOnboardingStep());
      if (step !== "done") {
        throw redirect({ to: welcomePath[step] });
      }
      if (pathname.startsWith("/welcome")) {
        throw redirect({ to: "/home" });
      }
      const memberBoard = yield* Effect.promise(() => loadMemberFlags());
      return { memberBoard, session };
    }),
  );
}

function enterWelcomeFrame(href: string): Promise<{ session: Session; step: OnboardingStep }> {
  return Effect.runPromise(
    Effect.gen(function* enterWelcome() {
      const session = yield* Effect.promise(() => loadSession());
      if (session === undefined) {
        throw redirect({ href: loginPath(href) });
      }
      const step = yield* Effect.promise(() => loadOnboardingStep());
      if (step === "done") {
        throw redirect({ to: "/home" });
      }
      return { session, step };
    }),
  );
}

export { enterMemberFrame, enterPublicFrame, enterWelcomeFrame, welcomePath };
