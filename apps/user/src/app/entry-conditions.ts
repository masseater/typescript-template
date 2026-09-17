import type { Session } from "#entities/session/index.ts";
import { loadSession } from "#entities/session/index.ts";
import { loginPath } from "@template/ui";
import { redirect } from "@tanstack/react-router";

const entrances: ReadonlySet<string> = new Set(["/", "/login", "/signup"]);

async function enterPublicFrame(pathname: string): Promise<void> {
  if (!entrances.has(pathname)) {
    return;
  }
  const session = await loadSession();
  if (session !== undefined) {
    throw redirect({ params: { id: session.user.id }, to: "/users/$id" });
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
