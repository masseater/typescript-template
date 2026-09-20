import { loginPath } from "@repo/auth-ui";
import { redirect } from "@tanstack/react-router";

import { loadSession } from "#entities/session/index.ts";

import type { Session } from "#entities/session/index.ts";

const entrances: ReadonlySet<string> = new Set(["/", "/login", "/signup"]);

async function enterPublicFrame(pathname: string): Promise<void> {
  if (!entrances.has(pathname)) {
    return;
  }
  const session = await loadSession();
  if (session !== undefined) {
    throw redirect({ to: "/home" });
  }
}

async function enterMemberFrame(href: string): Promise<{ session: Session }> {
  const session = await loadSession();
  if (session === undefined) {
    throw redirect({ href: loginPath(href) });
  }
  return { session };
}

export { enterMemberFrame, enterPublicFrame };
