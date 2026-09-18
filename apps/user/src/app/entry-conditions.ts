import { redirect } from "@tanstack/react-router";
import { loginPath } from "@template/ui";

import { loadSession, type Session } from "#entities/session/index.ts";

const entrances: ReadonlySet<string> = new Set(["/", "/login", "/signup"]);

const enterPublicFrame = async (pathname: string): Promise<void> => {
  if (!entrances.has(pathname)) {
    return;
  }
  const session = await loadSession();
  if (session !== undefined) {
    throw redirect({ params: { id: session.user.id }, to: "/users/$id" });
  }
};

const enterMemberFrame = async (href: string): Promise<{ session: Session }> => {
  const session = await loadSession();
  if (session === undefined) {
    throw redirect({ href: loginPath(href) });
  }
  return { session };
};

export { enterMemberFrame, enterPublicFrame };
